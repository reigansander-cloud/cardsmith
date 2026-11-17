set client_min_messages = warning;
-- =============================================================================
-- CardSmith on Supabase — database setup
--
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste the
-- whole file -> Run. It is safe to run again later (it only (re)creates things).
--
-- Design: every Base44 entity (Card, CardEntry, Deck, Folder, Game, ...) lives
-- in ONE table, `records`, with the entity name in a column and the entity's
-- fields in a JSON `data` column. That mirrors how Base44 stores data, keeps
-- every existing record id (so folder_id / deck_id / entry_id references keep
-- working after the import) and lets the app keep using the same
-- base44.entities.X.list/filter/create/update/... calls it already has.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create or replace function public.new_record_id() returns text
language sql volatile as $$
  -- 24 hex chars, the same shape as Base44 ids.
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)
$$;

create table if not exists public.records (
  id            text primary key default public.new_record_id(),
  entity        text not null,
  data          jsonb not null default '{}'::jsonb,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by    text,
  created_by_id text
);

create index if not exists records_entity_created_idx on public.records (entity, created_date desc);
create index if not exists records_folder_idx on public.records (entity, (data->>'folder_id'));
create index if not exists records_entry_idx on public.records (entity, (data->>'entry_id'));
create index if not exists records_user_auth_idx on public.records ((data->>'auth_uid')) where entity = 'User';
create index if not exists records_user_email_idx on public.records (lower(data->>'email')) where entity = 'User';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The record as the app sees it: its fields plus the built-in ones.
create or replace function public.record_json(r public.records) returns jsonb
language sql immutable as $$
  select coalesce(r.data, '{}'::jsonb) || jsonb_build_object(
    'id', r.id,
    'created_date', r.created_date,
    'updated_date', r.updated_date,
    'created_by', r.created_by,
    'created_by_id', r.created_by_id
  )
$$;

-- Built-in fields are columns, never stored inside `data`.
create or replace function public.records_strip(p jsonb) returns jsonb
language sql immutable as $$
  select coalesce(p, '{}'::jsonb) - 'id' - 'created_date' - 'updated_date' - 'created_by' - 'created_by_id'
$$;

-- Applies a patch to a record's data. Plain fields are simply overwritten.
-- Fields that carry versions (the Play Clans Game record does this, see
-- src/lib/versionedMerge.js) only overwrite if newer: `_fv_<field>` is the
-- field's version and, for lists, `_ev_<field>` holds one version per slot, so
-- two players changing different slots of the same list both land.
create or replace function public.merge_versioned(old jsonb, patch jsonb) returns jsonb
language plpgsql immutable as $$
declare
  out jsonb := coalesce(old, '{}'::jsonb);
  k text; v jsonb; ps numeric; os numeric; pe jsonb; oe jsonb; ov jsonb;
  arr jsonb; ev jsonb; i int; n int; touched boolean;
begin
  for k, v in select * from jsonb_each(coalesce(patch, '{}'::jsonb)) loop
    if left(k, 4) in ('_fv_', '_ev_') then continue; end if;
    ps := case when jsonb_typeof(patch->('_fv_' || k)) = 'number' then (patch->>('_fv_' || k))::numeric end;
    if ps is null then
      out := out || jsonb_build_object(k, v);
      continue;
    end if;
    os := case when jsonb_typeof(out->('_fv_' || k)) = 'number' then (out->>('_fv_' || k))::numeric end;
    pe := patch->('_ev_' || k);
    oe := out->('_ev_' || k);
    ov := out->k;

    if jsonb_typeof(pe) = 'array' and jsonb_typeof(v) = 'array' then
      if os is null or jsonb_typeof(oe) is distinct from 'array' or jsonb_typeof(ov) is distinct from 'array' or ps > os then
        if os is null or ps > os then
          out := out || jsonb_build_object(k, v, '_fv_' || k, ps, '_ev_' || k, pe);
        end if;
        continue;
      end if;
      if ps < os then continue; end if;
      n := jsonb_array_length(v);
      if n <> jsonb_array_length(ov) or n <> jsonb_array_length(pe) or n <> jsonb_array_length(oe) then continue; end if;
      arr := ov; ev := oe; touched := false;
      for i in 0 .. n - 1 loop
        if jsonb_typeof(pe->i) = 'number' and (jsonb_typeof(oe->i) <> 'number' or (pe->>i)::numeric > (oe->>i)::numeric) then
          arr := jsonb_set(arr, array[i::text], v->i);
          ev := jsonb_set(ev, array[i::text], pe->i);
          touched := true;
        end if;
      end loop;
      if touched then out := out || jsonb_build_object(k, arr, '_ev_' || k, ev); end if;
    else
      if os is null or ps > os then
        out := out || jsonb_build_object(k, v, '_fv_' || k, ps);
      end if;
    end if;
  end loop;
  return out;
end $$;

-- The app-level id of the signed-in person. Imported Base44 users keep their
-- old id (so created_by_id, Game.players[].user_id etc. still match); brand
-- new users get their Supabase auth id.
create or replace function public.app_user_id() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select id from public.records where entity = 'User' and data->>'auth_uid' = auth.uid()::text limit 1),
    auth.uid()::text
  )
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.records
    where entity = 'User' and data->>'auth_uid' = auth.uid()::text and data->>'role' = 'admin'
  )
$$;

-- Reads one field of a record (built-in column, top-level field, or a.b path).
create or replace function public.record_field(r public.records, k text) returns jsonb
language sql immutable as $$
  select case k
    when 'id' then to_jsonb(r.id)
    when 'created_date' then to_jsonb(r.created_date)
    when 'updated_date' then to_jsonb(r.updated_date)
    when 'created_by' then to_jsonb(r.created_by)
    when 'created_by_id' then to_jsonb(r.created_by_id)
    else case when position('.' in k) > 0 then r.data #> string_to_array(k, '.') else r.data -> k end
  end
$$;

-- Equality the way Base44 (MongoDB) does it: null matches missing, and an
-- array field matches if it contains the value.
create or replace function public.json_eq(fv jsonb, v jsonb) returns boolean
language sql immutable as $$
  select case
    when v is null or v = 'null'::jsonb then (fv is null or fv = 'null'::jsonb)
    when fv is null then false
    when fv = v then true
    when jsonb_typeof(fv) = 'array' and jsonb_typeof(v) <> 'array' then fv @> jsonb_build_array(v)
    else false
  end
$$;

create or replace function public.json_cmp(fv jsonb, op text, v jsonb) returns boolean
language plpgsql immutable as $$
declare a numeric; b numeric; ta text; tb text;
begin
  if fv is null or fv = 'null'::jsonb or v is null or v = 'null'::jsonb then return false; end if;
  if jsonb_typeof(fv) = 'number' and jsonb_typeof(v) = 'number' then
    a := (fv #>> '{}')::numeric; b := (v #>> '{}')::numeric;
    return case op when '$gt' then a > b when '$gte' then a >= b when '$lt' then a < b else a <= b end;
  end if;
  ta := fv #>> '{}'; tb := v #>> '{}';
  return case op when '$gt' then ta > tb when '$gte' then ta >= tb when '$lt' then ta < tb else ta <= tb end;
end $$;

-- Does a record match a Base44-style filter object?
-- Supports: plain equality, $eq $ne $in $nin $gt $gte $lt $lte $exists
-- $regex (+ $options 'i'), and $or / $and / $nor.
create or replace function public.record_matches(r public.records, f jsonb) returns boolean
language plpgsql stable as $$
declare
  k text; v jsonb; op text; arg jsonb; fv jsonb; hit boolean; ci boolean;
begin
  if f is null or f = '{}'::jsonb then return true; end if;
  for k, v in select * from jsonb_each(f) loop
    if k = '$or' then
      if not exists (select 1 from jsonb_array_elements(v) e where public.record_matches(r, e)) then return false; end if;
    elsif k = '$and' then
      if exists (select 1 from jsonb_array_elements(v) e where not public.record_matches(r, e)) then return false; end if;
    elsif k = '$nor' then
      if exists (select 1 from jsonb_array_elements(v) e where public.record_matches(r, e)) then return false; end if;
    else
      fv := public.record_field(r, k);
      if jsonb_typeof(v) = 'object' and exists (select 1 from jsonb_object_keys(v) ok where left(ok, 1) = '$') then
        ci := coalesce(v->>'$options', '') ilike '%i%';
        for op, arg in select * from jsonb_each(v) loop
          if op = '$options' then continue; end if;
          if op = '$eq' then
            hit := public.json_eq(fv, arg);
          elsif op = '$ne' then
            hit := not public.json_eq(fv, arg);
          elsif op in ('$in', '$nin') then
            hit := exists (select 1 from jsonb_array_elements(arg) a where public.json_eq(fv, a));
            if op = '$nin' then hit := not hit; end if;
          elsif op in ('$gt', '$gte', '$lt', '$lte') then
            hit := public.json_cmp(fv, op, arg);
          elsif op = '$exists' then
            hit := ((fv is not null and fv <> 'null'::jsonb) = (arg = 'true'::jsonb));
          elsif op = '$regex' then
            if fv is null or jsonb_typeof(fv) <> 'string' then hit := false;
            elsif ci then hit := (fv #>> '{}') ~* (arg #>> '{}');
            else hit := (fv #>> '{}') ~ (arg #>> '{}');
            end if;
          else
            raise exception 'Unsupported filter operator: %', op;
          end if;
          if not hit then return false; end if;
        end loop;
      else
        if not public.json_eq(fv, v) then return false; end if;
      end if;
    end if;
  end loop;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Reads / writes the app calls (through src/api/base44Client.js)
-- ---------------------------------------------------------------------------

create or replace function public.records_query(
  p_entity text, p_filter jsonb default '{}'::jsonb, p_sort text default null,
  p_limit int default null, p_skip int default 0
) returns setof jsonb
language plpgsql stable set search_path = public as $$
declare ord text; fld text; dir text;
begin
  if p_sort is null or p_sort = '' then
    ord := 'created_date desc, id';
  else
    dir := case when left(p_sort, 1) = '-' then 'desc' else 'asc' end;
    fld := ltrim(p_sort, '-+');
    if fld in ('id', 'created_date', 'updated_date', 'created_by', 'created_by_id') then
      ord := format('%I %s', fld, dir);
    else
      ord := format('(data -> %L) %s nulls %s', fld, dir, case dir when 'asc' then 'first' else 'last' end);
    end if;
    ord := ord || ', created_date desc, id';
  end if;
  -- The common lookups (by id, folder or entry) use an index first; the
  -- full filter is then checked on just those rows.
  return query execute format(
    'select public.record_json(r) from public.records r
      where r.entity = $1
        and ($5::text is null or r.id = $5)
        and ($6::text is null or r.data->>''folder_id'' = $6)
        and ($7::text is null or r.data->>''entry_id'' = $7)
        and public.record_matches(r, $2)
      order by %s limit $3 offset $4', ord)
    using p_entity, coalesce(p_filter, '{}'::jsonb), least(coalesce(p_limit, 10000), 10000), greatest(coalesce(p_skip, 0), 0),
      case when jsonb_typeof(p_filter->'id') = 'string' then p_filter->>'id' end,
      case when jsonb_typeof(p_filter->'folder_id') = 'string' then p_filter->>'folder_id' end,
      case when jsonb_typeof(p_filter->'entry_id') = 'string' then p_filter->>'entry_id' end;
end $$;

create or replace function public.records_get(p_entity text, p_id text) returns jsonb
language plpgsql stable set search_path = public as $$
declare out jsonb;
begin
  select public.record_json(r) into out from public.records r where r.entity = p_entity and r.id = p_id;
  if out is null then raise exception 'Entity % % not found', p_entity, p_id using errcode = 'P0002'; end if;
  return out;
end $$;

create or replace function public.records_create(p_entity text, p_data jsonb) returns jsonb
language sql volatile set search_path = public as $$
  insert into public.records (entity, data) values (p_entity, public.records_strip(p_data))
  returning public.record_json(records)
$$;

create or replace function public.records_bulk_create(p_entity text, p_items jsonb) returns setof jsonb
language sql volatile set search_path = public as $$
  insert into public.records (entity, data)
  select p_entity, public.records_strip(i.value)
  from jsonb_array_elements(p_items) with ordinality as i(value, n)
  order by i.n
  returning public.record_json(records)
$$;

create or replace function public.records_update(p_entity text, p_id text, p_patch jsonb) returns jsonb
language plpgsql volatile set search_path = public as $$
declare out jsonb;
begin
  -- `data || patch` runs under the row lock, so two players writing different
  -- fields of the same Game at the same moment both land.
  update public.records r set data = public.merge_versioned(r.data, public.records_strip(p_patch))
   where r.entity = p_entity and r.id = p_id
  returning public.record_json(r) into out;
  if out is null then raise exception 'Entity % % not found', p_entity, p_id using errcode = 'P0002'; end if;
  return out;
end $$;

create or replace function public.records_bulk_update(p_entity text, p_items jsonb) returns setof jsonb
language sql volatile set search_path = public as $$
  update public.records r set data = public.merge_versioned(r.data, public.records_strip(i.value))
    from jsonb_array_elements(p_items) i
   where r.entity = p_entity and r.id = i.value->>'id'
  returning public.record_json(r)
$$;

-- Adds an item to a list field in one atomic step (used to join a Play Clans
-- lobby: two people joining at the same moment both get in). With
-- p_unique_by, nothing is added if an item with the same value is already
-- there (joining twice). Marks the list as restructured with a new version.
create or replace function public.records_append(
  p_entity text, p_id text, p_key text, p_item jsonb, p_unique_by text default null, p_version numeric default null
) returns jsonb
language plpgsql volatile set search_path = public as $$
declare d jsonb; lst jsonb; ver numeric; n int;
begin
  select data into d from public.records where entity = p_entity and id = p_id for update;
  if d is null then raise exception 'Entity % % not found', p_entity, p_id using errcode = 'P0002'; end if;
  lst := case when jsonb_typeof(d->p_key) = 'array' then d->p_key else '[]'::jsonb end;
  if p_unique_by is null or not exists (
       select 1 from jsonb_array_elements(lst) e where e->>p_unique_by = p_item->>p_unique_by) then
    lst := lst || jsonb_build_array(p_item);
    n := jsonb_array_length(lst);
    ver := greatest(coalesce(p_version, 0), coalesce((d->>('_fv_' || p_key))::numeric, 0) + 1);
    update public.records set data = data || jsonb_build_object(
        p_key, lst, '_fv_' || p_key, ver,
        '_ev_' || p_key, (select jsonb_agg(ver) from generate_series(1, n)))
     where entity = p_entity and id = p_id;
  end if;
  return public.records_get(p_entity, p_id);
end $$;

create or replace function public.records_update_many(p_entity text, p_filter jsonb, p_update jsonb) returns jsonb
language plpgsql volatile set search_path = public as $$
declare n int; setp jsonb; unsetk text[];
begin
  if p_update ? '$set' or p_update ? '$unset' then
    setp := coalesce(p_update->'$set', '{}'::jsonb);
    unsetk := coalesce((select array_agg(k) from jsonb_object_keys(coalesce(p_update->'$unset', '{}'::jsonb)) k), '{}');
  else
    setp := p_update; unsetk := '{}';
  end if;
  update public.records r set data = (r.data - unsetk) || public.records_strip(setp)
   where r.entity = p_entity and public.record_matches(r, p_filter);
  get diagnostics n = row_count;
  return jsonb_build_object('success', true, 'updated', n, 'has_more', false);
end $$;

create or replace function public.records_delete(p_entity text, p_id text) returns jsonb
language sql volatile set search_path = public as $$
  with d as (delete from public.records where entity = p_entity and id = p_id returning id)
  select jsonb_build_object('success', true, 'deleted', (select count(*) from d))
$$;

create or replace function public.records_delete_many(p_entity text, p_filter jsonb) returns jsonb
language plpgsql volatile set search_path = public as $$
declare n int;
begin
  delete from public.records r where r.entity = p_entity and public.record_matches(r, p_filter);
  get diagnostics n = row_count;
  return jsonb_build_object('success', true, 'deleted', n, 'has_more', false);
end $$;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

-- Called on sign-in. Returns this person's User record, creating it if needed.
-- If a User imported from Base44 has the same email, that record is claimed so
-- the person keeps their old id, preferences and ownership of their things.
-- The very first person ever to sign in becomes an admin.
create or replace function public.claim_profile() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid text := auth.uid()::text;
  em text := lower(coalesce(auth.jwt()->>'email', ''));
  meta jsonb := coalesce(auth.jwt()->'user_metadata', '{}'::jsonb);
  r public.records;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;

  select * into r from public.records where entity = 'User' and data->>'auth_uid' = uid limit 1;

  if r.id is null and em <> '' then
    update public.records set data = data || jsonb_build_object('auth_uid', uid)
     where id = (
       select id from public.records
        where entity = 'User' and lower(data->>'email') = em and coalesce(data->>'auth_uid', '') = ''
        order by created_date limit 1)
    returning * into r;
  end if;

  if r.id is null then
    insert into public.records (id, entity, data, created_by, created_by_id)
    values (uid, 'User', jsonb_build_object(
        'email', em,
        'full_name', coalesce(meta->>'full_name', meta->>'name', split_part(em, '@', 1)),
        'role', case when exists (select 1 from public.records where entity = 'User') then 'user' else 'admin' end,
        'auth_uid', uid),
      em, uid)
    on conflict (id) do nothing;
    select * into r from public.records where entity = 'User' and data->>'auth_uid' = uid limit 1;
  end if;

  return public.record_json(r);
end $$;

create or replace function public.update_me(p_patch jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare out jsonb;
begin
  update public.records r
     set data = r.data || (public.records_strip(p_patch) - 'role' - 'auth_uid' - 'email')
   where r.entity = 'User' and r.data->>'auth_uid' = auth.uid()::text
  returning public.record_json(r) into out;
  if out is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  return out;
end $$;

-- One-time import from Base44 (used by the site's /admin/import page).
-- Admin only. Inserts or updates records keeping their Base44 ids and dates.
-- If an imported user has the same email as someone who already signed in
-- here, that login is moved onto the imported (old-id) account.
create or replace function public.admin_import_records(p_rows jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int; fresh public.records; imp record;
begin
  if not public.is_admin() then raise exception 'Only an admin can import' using errcode = '42501'; end if;
  perform set_config('cardsmith.importing', '1', true);
  insert into public.records (id, entity, data, created_date, updated_date, created_by, created_by_id)
  select r->>'id', r->>'entity', public.records_strip(coalesce(r->'data', '{}'::jsonb)),
         coalesce((r->>'created_date')::timestamptz, now()),
         coalesce((r->>'updated_date')::timestamptz, (r->>'created_date')::timestamptz, now()),
         nullif(r->>'created_by', ''), nullif(r->>'created_by_id', '')
    from jsonb_array_elements(p_rows) r
   where coalesce(r->>'id', '') <> '' and coalesce(r->>'entity', '') <> ''
  on conflict (id) do update
     set data = case when records.entity = 'User' and records.data ? 'auth_uid'
                     then excluded.data || jsonb_build_object('auth_uid', records.data->'auth_uid')
                     else excluded.data end,
         created_date = excluded.created_date;
  get diagnostics n = row_count;

  -- Link existing logins to imported accounts with the same email.
  for imp in
    select r->>'id' as id, lower(r->'data'->>'email') as email
      from jsonb_array_elements(p_rows) r
     where r->>'entity' = 'User' and coalesce(r->'data'->>'email', '') <> ''
  loop
    select * into fresh from public.records
     where entity = 'User' and id <> imp.id and lower(data->>'email') = imp.email
       and coalesce(data->>'auth_uid', '') <> '' limit 1;
    if fresh.id is not null then
      update public.records set data = data || jsonb_build_object('auth_uid', fresh.data->>'auth_uid')
        || case when fresh.data->>'role' = 'admin' then '{"role":"admin"}'::jsonb else '{}'::jsonb end
       where id = imp.id;
      -- Things made on the new site before the import move to the old id.
      update public.records set created_by_id = imp.id where created_by_id = fresh.id;
      delete from public.records where id = fresh.id;
    end if;
    fresh := null;
  end loop;
  return jsonb_build_object('imported', n);
end $$;

-- ---------------------------------------------------------------------------
-- Defaults on write
-- ---------------------------------------------------------------------------
create or replace function public.records_before_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.id := coalesce(nullif(new.id, ''), public.new_record_id());
    new.data := public.records_strip(new.data);
    if auth.uid() is not null and coalesce(current_setting('cardsmith.importing', true), '') <> '1' then
      new.created_by_id := coalesce(new.created_by_id, public.app_user_id());
      new.created_by := coalesce(new.created_by, lower(auth.jwt()->>'email'));
    end if;
    -- (the importer passes created_date explicitly; normal inserts use now())
    new.created_date := coalesce(new.created_date, now());
    new.updated_date := coalesce(new.updated_date, new.created_date);
  else
    new.id := old.id; new.entity := old.entity;
    if coalesce(current_setting('cardsmith.importing', true), '') <> '1' then
      new.created_date := old.created_date; new.created_by := old.created_by; new.created_by_id := old.created_by_id;
    end if;
    new.updated_date := now();
  end if;
  return new;
end $$;

drop trigger if exists records_before_write on public.records;
create trigger records_before_write before insert or update on public.records
for each row execute function public.records_before_write();

-- ---------------------------------------------------------------------------
-- Live updates (what Base44's entities.X.subscribe() did)
--
-- After every write, one message goes out on the private Realtime topic
-- "records:<Entity>". A single-row change carries the whole record, like
-- Base44's events. A multi-row change (bulkUpdate, deleteMany, ...) sends one
-- message with the ids instead of hundreds of messages, so it can't blow
-- through the free plan's 100 messages/second; the app fetches those rows.
-- Records too big for one message (Realtime caps a message at 256 KB on the
-- free plan) send only their changed fields ({_partial: true}), or as a last
-- resort {_refetch: true} so the app fetches them.
-- ---------------------------------------------------------------------------
create or replace function public.records_broadcast() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  op text := case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end;
  g record; d jsonb; ids jsonb; i int;
begin
  for g in
    select x.entity, count(*) as n, jsonb_agg(x.id order by x.id) as ids, (array_agg(public.record_json(x)))[1] as one
      from (select * from new_or_old_rows) x
     group by x.entity
  loop
    if g.n = 1 then
      d := g.one;
      if op = 'delete' then
        d := jsonb_build_object('id', d->>'id');
      elsif octet_length(d::text) > 200000 then
        -- Too big for one message. For an update, send just the fields that
        -- changed (a Game move usually touches one or two zones); if even that
        -- is too big, ask the app to fetch the record.
        if op = 'update' then
          select jsonb_object_agg(e.key, e.value) into d
            from jsonb_each(g.one) e
           where e.key in ('id', 'updated_date', 'last_update_client_id')
              or (select o.data -> e.key from old_rows o where o.id = g.one->>'id') is distinct from e.value;
          d := d || jsonb_build_object('_partial', true);
        end if;
        if op <> 'update' or octet_length(d::text) > 200000 then
          d := jsonb_build_object('id', g.one->>'id', '_refetch', true,
                                  'last_update_client_id', g.one->'last_update_client_id');
        end if;
      end if;
      perform realtime.send(
        jsonb_build_object('type', op, 'id', d->>'id', 'entity', g.entity, 'data', d, 'timestamp', now()),
        op, 'records:' || g.entity, true);
    else
      i := 0;
      while i < g.n loop
        select jsonb_agg(e) into ids from (select e from jsonb_array_elements(g.ids) with ordinality t(e, k) where k > i and k <= i + 2000) s;
        perform realtime.send(
          jsonb_build_object('type', 'bulk', 'op', op, 'entity', g.entity, 'ids', ids, 'timestamp', now()),
          'bulk', 'records:' || g.entity, true);
        i := i + 2000;
      end loop;
    end if;
  end loop;
  return null;
end $$;

-- One function body, three statement-level triggers; each trigger exposes its
-- changed rows under the same name (new_or_old_rows).
drop trigger if exists records_broadcast_ins on public.records;
drop trigger if exists records_broadcast_upd on public.records;
drop trigger if exists records_broadcast_del on public.records;
create trigger records_broadcast_ins after insert on public.records
  referencing new table as new_or_old_rows for each statement execute function public.records_broadcast();
create trigger records_broadcast_upd after update on public.records
  referencing old table as old_rows new table as new_or_old_rows for each statement execute function public.records_broadcast();
create trigger records_broadcast_del after delete on public.records
  referencing old table as new_or_old_rows for each statement execute function public.records_broadcast();

-- ---------------------------------------------------------------------------
-- Who can do what
--
-- Same as the Base44 app: anyone signed in can read and change everything
-- (all your entities had open rules), except User records, which only their
-- owner (or an admin) can change. Signed-out visitors can't read anything.
-- ---------------------------------------------------------------------------
alter table public.records enable row level security;

drop policy if exists records_select on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;

create policy records_select on public.records for select to authenticated using (true);
create policy records_insert on public.records for insert to authenticated
  with check (entity <> 'User');
create policy records_update on public.records for update to authenticated
  using (entity <> 'User' or data->>'auth_uid' = auth.uid()::text or public.is_admin());
create policy records_delete on public.records for delete to authenticated
  using (entity <> 'User' or public.is_admin());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.records to authenticated;
revoke all on public.records from anon;

do $$
declare f text;
begin
  foreach f in array array[
    'records_query(text,jsonb,text,integer,integer)', 'records_get(text,text)',
    'records_create(text,jsonb)', 'records_bulk_create(text,jsonb)',
    'records_update(text,text,jsonb)', 'records_bulk_update(text,jsonb)',
    'records_update_many(text,jsonb,jsonb)', 'records_delete(text,text)',
    'records_delete_many(text,jsonb)', 'records_append(text,text,text,jsonb,text,numeric)',
    'admin_import_records(jsonb)', 'claim_profile()', 'update_me(jsonb)',
    'app_user_id()', 'is_admin()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime permissions (Supabase only): signed-in users may listen on, and
-- send fast game moves to, the records:* topics.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "cardsmith listen" on realtime.messages';
    execute 'drop policy if exists "cardsmith send" on realtime.messages';
    execute $p$create policy "cardsmith listen" on realtime.messages for select to authenticated
             using (realtime.topic() like 'records:%')$p$;
    execute $p$create policy "cardsmith send" on realtime.messages for insert to authenticated
             with check (realtime.topic() like 'records:%' and extension = 'broadcast')$p$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- File uploads (what Base44's Core.UploadFile did): a public "uploads" bucket.
-- Anyone can view a file by its URL (Base44 file URLs worked the same way);
-- only signed-in users can upload.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('uploads', 'uploads', true)
    on conflict (id) do update set public = true;
    execute 'drop policy if exists "cardsmith uploads read" on storage.objects';
    execute 'drop policy if exists "cardsmith uploads write" on storage.objects';
    execute 'drop policy if exists "cardsmith uploads replace" on storage.objects';
    execute $p$create policy "cardsmith uploads read" on storage.objects for select
             using (bucket_id = 'uploads')$p$;
    execute $p$create policy "cardsmith uploads write" on storage.objects for insert to authenticated
             with check (bucket_id = 'uploads')$p$;
    -- (re-running the import overwrites the files it copied before)
    execute $p$create policy "cardsmith uploads replace" on storage.objects for update to authenticated
             using (bucket_id = 'uploads') with check (bucket_id = 'uploads')$p$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Keep-alive: the "Keep Supabase awake" GitHub workflow calls this every few
-- days so the free project isn't paused for inactivity. It reads nothing.
-- ---------------------------------------------------------------------------
create or replace function public.keepalive() returns integer
language sql stable as $$ select 1 $$;
revoke execute on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
