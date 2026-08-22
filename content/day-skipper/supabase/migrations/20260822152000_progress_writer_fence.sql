-- Progress proof v2 separates the actual exam-capped interval (`ivl`) from the
-- uncapped proof (`pv`) and records schedule provenance (`sr`). A client from
-- before that model can read pv and then erase it on re-graduation, so the
-- writer version must be established by the RPC used, not trusted from JSON an
-- old client can copy back unchanged.

alter table sync.blobs
  add column if not exists writer_version smallint not null default 1;

comment on column sync.blobs.writer_version is
  'Out-of-band client writer capability. Version 2 rows reject legacy writes.';


-- Legacy readers may continue syncing untouched v1 rows during rollout, but a
-- v2 row is invisible to them. Their subsequent revision-zero write is refused
-- by sync_put below, so they can neither consume nor overwrite v2 progress.
create or replace function public.sync_get(p_app text, p_key_hash text)
returns table (rev bigint, data jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad key' using errcode = '22023';
  end if;

  return query
    select b.rev, b.data, b.updated_at
      from sync.blobs b
     where b.app = p_app
       and b.key_hash = p_key_hash
       and b.writer_version < 2;
end;
$$;


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
  if octet_length(p_data::text) > v_max then
    raise exception 'payload too large' using errcode = '22023';
  end if;

  select * into v_cur
    from sync.blobs b
   where b.app = p_app
     and b.key_hash = p_key_hash
     for update;

  if not found then
    insert into sync.blobs (app, key_hash, rev, data, writer_version)
    values (p_app, p_key_hash, 1, p_data, 1);
    return query select true, 1::bigint, p_data;
    return;
  end if;

  if v_cur.writer_version >= 2 then
    raise exception 'sync client update required' using errcode = '55000';
  end if;
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


-- Current clients use a separate capability and explicitly state the version
-- for diagnostics. Reading through this capability adopts a v1 row immediately:
-- an equal local/remote merge has no reason to write, but must still close the
-- window in which a legacy client could erase progress proof.
create or replace function public.sync_get_v2(
  p_app text,
  p_key_hash text,
  p_writer_version integer
)
returns table (rev bigint, data jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_writer_version is distinct from 2 then
    raise exception 'unsupported writer version' using errcode = '22023';
  end if;
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad key' using errcode = '22023';
  end if;

  -- Do not touch updated_at: capability adoption is not a content write and
  -- must not trip the one-write-per-second throttle for the client that read it.
  -- The row lock from UPDATE serialises with legacy sync_put; after this point
  -- any such writer observes version 2 and fails closed.
  update sync.blobs b
     set writer_version = 2
   where b.app = p_app
     and b.key_hash = p_key_hash
     and b.writer_version < 2;

  return query
    select b.rev, b.data, b.updated_at
      from sync.blobs b
     where b.app = p_app
       and b.key_hash = p_key_hash;
end;
$$;


create or replace function public.sync_put_v2(
  p_app            text,
  p_key_hash       text,
  p_rev            bigint,
  p_data           jsonb,
  p_writer_version integer
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
  if p_writer_version is distinct from 2 then
    raise exception 'unsupported writer version' using errcode = '22023';
  end if;
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad key' using errcode = '22023';
  end if;

  select a.max_bytes into v_max from sync.apps a where a.app = p_app;
  if v_max is null then
    raise exception 'unknown app' using errcode = '22023';
  end if;
  if octet_length(p_data::text) > v_max then
    raise exception 'payload too large' using errcode = '22023';
  end if;

  select * into v_cur
    from sync.blobs b
   where b.app = p_app
     and b.key_hash = p_key_hash
     for update;

  if not found then
    insert into sync.blobs (app, key_hash, rev, data, writer_version)
    values (p_app, p_key_hash, 1, p_data, 2);
    return query select true, 1::bigint, p_data;
    return;
  end if;

  if v_cur.updated_at > now() - interval '1 second' then
    raise exception 'too fast' using errcode = '53400';
  end if;
  if v_cur.rev is distinct from p_rev then
    return query select false, v_cur.rev, v_cur.data;
    return;
  end if;

  update sync.blobs b
     set data = p_data,
         rev = b.rev + 1,
         writer_version = 2,
         updated_at = now()
   where b.app = p_app
     and b.key_hash = p_key_hash;

  return query select true, v_cur.rev + 1, p_data;
end;
$$;


revoke execute on function public.sync_get(text, text) from public;
revoke execute on function public.sync_put(text, text, bigint, jsonb) from public;
revoke execute on function public.sync_get_v2(text, text, integer) from public;
revoke execute on function public.sync_put_v2(text, text, bigint, jsonb, integer) from public;

grant execute on function public.sync_get(text, text) to anon, authenticated;
grant execute on function public.sync_put(text, text, bigint, jsonb) to anon, authenticated;
grant execute on function public.sync_get_v2(text, text, integer) to anon, authenticated;
grant execute on function public.sync_put_v2(text, text, bigint, jsonb, integer)
  to anon, authenticated;
