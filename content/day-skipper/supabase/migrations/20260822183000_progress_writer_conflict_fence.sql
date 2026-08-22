-- Fence a row even when v2 first meets it through a concurrent read or write.
--
-- The earlier GET ran UPDATE and SELECT as separate commands. A cached v1
-- client could insert between them, so GET returned an unfenced row and an
-- equal local document skipped PUT. The PUT also used to return a revision
-- conflict before adoption. Re-declare both RPCs under a fresh ledger version
-- so environments which recorded either earlier fence migration receive the
-- locked-read and adopt-before-CAS ordering together.

create or replace function public.sync_get_v2(
  p_app            text,
  p_key_hash       text,
  p_writer_version integer
)
returns table (rev bigint, data jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cur sync.blobs%rowtype;
begin
  if p_writer_version is distinct from 2 then
    raise exception 'unsupported writer version' using errcode = '22023';
  end if;
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad key' using errcode = '22023';
  end if;
  -- NULL can never name an allowlisted app. Besides making the boundary
  -- explicit, this is a non-mutating deployment fingerprint which the prior
  -- two-command implementation does not have.
  if p_app is null then
    raise exception 'bad app' using errcode = '22023';
  end if;

  -- One locked read decides both whether a row exists and which row is
  -- returned. If no row exists, return empty: a legacy insert after this point
  -- meets sync_put_v2's conflict fence. If one exists, no legacy writer can
  -- pass between this read, adoption, and the returned snapshot.
  select * into v_cur
    from sync.blobs b
   where b.app = p_app
     and b.key_hash = p_key_hash
     for update;

  if not found then
    return;
  end if;

  if v_cur.writer_version < 2 then
    update sync.blobs b
       set writer_version = 2
     where b.app = p_app
       and b.key_hash = p_key_hash;
  end if;

  return query select v_cur.rev, v_cur.data, v_cur.updated_at;
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
  v_adopted_legacy boolean;
begin
  if p_writer_version is distinct from 2 then
    raise exception 'unsupported writer version' using errcode = '22023';
  end if;
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad key' using errcode = '22023';
  end if;
  -- Validate before app lookup. Besides making NULL an explicit invalid CAS,
  -- this gives the non-mutating deployment probe a fingerprint unique to this
  -- migration: an unknown app with NULL revision must still say "bad revision".
  if p_rev is null or p_rev < 0 then
    raise exception 'bad revision' using errcode = '22023';
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

  v_adopted_legacy := v_cur.writer_version < 2;
  if v_adopted_legacy then
    -- Capability adoption is not a content write. Do not touch updated_at; the
    -- row lock serialises this with every legacy PUT. A conflict return below
    -- commits this update, so an equal document is fenced without another PUT.
    update sync.blobs b
       set writer_version = 2
     where b.app = p_app
       and b.key_hash = p_key_hash;
  end if;

  if v_cur.rev is distinct from p_rev then
    return query select false, v_cur.rev, v_cur.data;
    return;
  end if;

  -- A first v2 touch of a legacy row must not raise after the fence update:
  -- exceptions roll back the whole function call, including that fence. Its
  -- row lock and matching CAS make the content update safe. Rows already at v2
  -- retain the existing one-write-per-second throttle.
  if not v_adopted_legacy
     and v_cur.updated_at > now() - interval '1 second' then
    raise exception 'too fast' using errcode = '53400';
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

revoke execute on function public.sync_get_v2(text, text, integer) from public;
revoke execute on function public.sync_put_v2(text, text, bigint, jsonb, integer) from public;
grant execute on function public.sync_get_v2(text, text, integer)
  to anon, authenticated;
grant execute on function public.sync_put_v2(text, text, bigint, jsonb, integer)
  to anon, authenticated;
