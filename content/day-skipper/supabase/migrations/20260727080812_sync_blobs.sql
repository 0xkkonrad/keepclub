-- ---------------------------------------------------------------------------
-- Generic blob sync for small client-side apps.
--
-- One row per (app, key_hash). The server never looks inside `data` — it is
-- whatever JSON the app wants to keep, and every app owns its own merge rules
-- client-side. Adding an app is one INSERT into sync.apps, not a deployment.
--
-- Auth model: knowing the key IS the permission. The client hashes its secret
-- and only ever sends the hash, so the raw key is never stored here and a
-- database leak does not hand anyone a working key.
--
-- The important bit: the table is in the `sync` schema, which the Data API
-- does not expose, and anon holds no privileges on it. The only way in is the
-- two SECURITY DEFINER functions below, and both demand the key hash as an
-- argument. That is what makes this a capability rather than a table: there is
-- no query that returns rows you did not already have the key for. Exposing
-- the table directly with an RLS policy would NOT do this — a policy that lets
-- you read your own row by hash also lets you `select *` and read everyone's.
-- ---------------------------------------------------------------------------

create schema if not exists sync;

create table if not exists sync.apps (
  app        text primary key,
  max_bytes  integer     not null default 262144,
  created_at timestamptz not null default now()
);

comment on table sync.apps is
  'Allowlist. An app absent from here cannot create rows, so nobody can spray '
  'the database with junk namespaces.';

create table if not exists sync.blobs (
  app        text        not null references sync.apps(app) on delete cascade,
  key_hash   text        not null,
  rev        bigint      not null default 1,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (app, key_hash)
);

-- Only used by the TTL sweep, but that sweep does a full scan without it.
create index if not exists blobs_updated_at_idx on sync.blobs (updated_at);

-- Belt and braces: nothing can reach this table today, but if a future hand
-- exposes the schema, RLS-on-with-no-policies means it is closed rather than
-- wide open. The owner bypasses this, so the functions below still work.
alter table sync.blobs enable row level security;

insert into sync.apps (app) values
  ('day-skipper'),
  ('competent-crew')
on conflict do nothing;


-- ---------------------------------------------------------------------------
-- Read. Returns zero rows when nothing is stored yet, which the client reads
-- as "first sync on this key" rather than as an error.
-- ---------------------------------------------------------------------------
create or replace function public.sync_get(p_app text, p_key_hash text)
returns table (rev bigint, data jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A hash is 64 hex characters or it is not a hash. This also means guessing
  -- a live key is 2^256 work rather than "try short strings".
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad key' using errcode = '22023';
  end if;

  return query
    select b.rev, b.data, b.updated_at
      from sync.blobs b
     where b.app = p_app
       and b.key_hash = p_key_hash;
end;
$$;


-- ---------------------------------------------------------------------------
-- Write, with optimistic concurrency.
--
-- ok = true  → stored, `rev` is the new revision.
-- ok = false → you are behind; `data` is what is actually stored. Merge it
--              with your local state and call again with the returned `rev`.
--              This is the path that stops the laptop's upload from eating
--              the phone's session.
-- ---------------------------------------------------------------------------
create or replace function public.sync_put(
  p_app      text,
  p_key_hash text,
  p_rev      bigint,
  p_data     jsonb
)
returns table (ok boolean, rev bigint, data jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
  v_cur sync.blobs%rowtype;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad key' using errcode = '22023';
  end if;

  select a.max_bytes into v_max from sync.apps a where a.app = p_app;
  if v_max is null then
    raise exception 'unknown app' using errcode = '22023';
  end if;

  -- octet_length on the text form, not pg_column_size: we want the size the
  -- caller actually sent, not what it compresses to on disk.
  if octet_length(p_data::text) > v_max then
    raise exception 'payload too large' using errcode = '22023';
  end if;

  select * into v_cur
    from sync.blobs b
   where b.app = p_app
     and b.key_hash = p_key_hash
     for update;

  if not found then
    insert into sync.blobs (app, key_hash, rev, data)
    values (p_app, p_key_hash, 1, p_data);
    return query select true, 1::bigint, p_data;
    return;
  end if;

  -- Per-key throttle. A study app syncs a handful of times an hour; anything
  -- writing faster than once a second is a loop or an attack, and either way
  -- the row it is filling is one you cannot enumerate.
  if v_cur.updated_at > now() - interval '1 second' then
    raise exception 'too fast' using errcode = '53400';
  end if;

  if v_cur.rev <> p_rev then
    return query select false, v_cur.rev, v_cur.data;
    return;
  end if;

  update sync.blobs b
     set data = p_data,
         rev = b.rev + 1,
         updated_at = now()
   where b.app = p_app
     and b.key_hash = p_key_hash;

  return query select true, v_cur.rev + 1, p_data;
end;
$$;


-- ---------------------------------------------------------------------------
-- Privileges. Postgres grants EXECUTE to PUBLIC on new functions, so the
-- revoke is load-bearing, not decoration.
-- ---------------------------------------------------------------------------
revoke all on schema sync from anon, authenticated;
revoke all on all tables in schema sync from anon, authenticated;

revoke execute on function public.sync_get(text, text)                from public;
revoke execute on function public.sync_put(text, text, bigint, jsonb) from public;

grant execute on function public.sync_get(text, text)                to anon, authenticated;
grant execute on function public.sync_put(text, text, bigint, jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Optional, once you have enabled the pg_cron extension in the dashboard.
-- Keeps storage bounded by dropping keys nobody has touched in a year.
--
--   select cron.schedule('sync-ttl', '17 4 * * 0', $ttl$
--     delete from sync.blobs where updated_at < now() - interval '12 months'
--   $ttl$);
-- ---------------------------------------------------------------------------
