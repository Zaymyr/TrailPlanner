-- Track official race inputs that can make an attached runner plan stale.

begin;

alter table public.races
  add column if not exists plan_source_updated_at timestamptz not null default timezone('utc', now());

alter table public.race_plans
  add column if not exists source_revision_at_last_review timestamptz;

lock table public.races, public.race_plans, public.race_aid_stations,
  public.race_aid_station_products, public.race_start_waves, public.products
  in share row exclusive mode;

update public.race_plans plan_row
set source_revision_at_last_review = coalesce(
  plan_row.catalog_race_updated_at_at_import,
  race_row.plan_source_updated_at,
  timezone('utc', now())
)
from public.races race_row
where plan_row.race_id = race_row.id
  and plan_row.source_revision_at_last_review is null;

create or replace function public.bump_race_plan_source_revision()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.name is distinct from new.name
    or old.distance_km is distinct from new.distance_km
    or old.elevation_gain_m is distinct from new.elevation_gain_m
    or old.elevation_loss_m is distinct from new.elevation_loss_m
    or old.race_date is distinct from new.race_date
    or old.gpx_storage_path is distinct from new.gpx_storage_path
    or old.gpx_sha256 is distinct from new.gpx_sha256
    or old.organizer_details is distinct from new.organizer_details then
    new.plan_source_updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;

drop trigger if exists bump_race_plan_source_revision_trigger on public.races;
create trigger bump_race_plan_source_revision_trigger
before update on public.races
for each row execute function public.bump_race_plan_source_revision();

create or replace function public.bump_aid_station_race_plan_source_revision()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.races set plan_source_updated_at = clock_timestamp() where id = new.race_id;
  elsif tg_op = 'DELETE' then
    update public.races set plan_source_updated_at = clock_timestamp() where id = old.race_id;
  elsif old.race_id is distinct from new.race_id
    or old.name is distinct from new.name
    or old.km is distinct from new.km
    or old.water_available is distinct from new.water_available
    or old.solid_available is distinct from new.solid_available
    or old.assistance_allowed is distinct from new.assistance_allowed
    or old.notes is distinct from new.notes
    or old.organizer_details is distinct from new.organizer_details
    or old.order_index is distinct from new.order_index then
    update public.races
    set plan_source_updated_at = clock_timestamp()
    where id in (old.race_id, new.race_id);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists bump_aid_station_race_plan_source_revision_trigger on public.race_aid_stations;
create trigger bump_aid_station_race_plan_source_revision_trigger
after insert or update or delete on public.race_aid_stations
for each row execute function public.bump_aid_station_race_plan_source_revision();

create or replace function public.bump_aid_product_race_plan_source_revision()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.races race_row set plan_source_updated_at = clock_timestamp()
    where exists (select 1 from public.race_aid_stations station_row where station_row.id = new.race_aid_station_id and station_row.race_id = race_row.id);
  elsif tg_op = 'DELETE' then
    update public.races race_row set plan_source_updated_at = clock_timestamp()
    where exists (select 1 from public.race_aid_stations station_row where station_row.id = old.race_aid_station_id and station_row.race_id = race_row.id);
  elsif old.race_aid_station_id is distinct from new.race_aid_station_id
    or old.product_id is distinct from new.product_id
    or old.notes is distinct from new.notes
    or old.order_index is distinct from new.order_index then
    update public.races race_row
    set plan_source_updated_at = clock_timestamp()
    where exists (
      select 1 from public.race_aid_stations station_row
      where station_row.id in (old.race_aid_station_id, new.race_aid_station_id)
        and station_row.race_id = race_row.id
    );
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists bump_aid_product_race_plan_source_revision_trigger on public.race_aid_station_products;
create trigger bump_aid_product_race_plan_source_revision_trigger
after insert or update or delete on public.race_aid_station_products
for each row execute function public.bump_aid_product_race_plan_source_revision();

create or replace function public.bump_linked_product_race_plan_source_revisions()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.name is distinct from new.name
    or old.brand is distinct from new.brand
    or old.carbs_g is distinct from new.carbs_g
    or old.protein_g is distinct from new.protein_g
    or old.fat_g is distinct from new.fat_g
    or old.sodium_mg is distinct from new.sodium_mg
    or old.calories_kcal is distinct from new.calories_kcal
    or old.fuel_type is distinct from new.fuel_type
    or old.image_url is distinct from new.image_url
    or old.is_official is distinct from new.is_official
    or old.is_live is distinct from new.is_live
    or old.is_archived is distinct from new.is_archived then
    update public.races race_row
    set plan_source_updated_at = clock_timestamp()
    where exists (
      select 1
      from public.race_aid_station_products link_row
      join public.race_aid_stations station_row on station_row.id = link_row.race_aid_station_id
      where link_row.product_id = new.id
        and station_row.race_id = race_row.id
    );
  end if;
  return new;
end;
$$;

create or replace function public.bump_start_wave_race_plan_source_revision()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.races set plan_source_updated_at = clock_timestamp() where id = new.race_id;
  elsif tg_op = 'DELETE' then
    update public.races set plan_source_updated_at = clock_timestamp() where id = old.race_id;
  elsif old.race_id is distinct from new.race_id
    or old.name is distinct from new.name
    or old.start_time is distinct from new.start_time
    or old.order_index is distinct from new.order_index
    or old.eligibility_type is distinct from new.eligibility_type
    or old.eligibility_note is distinct from new.eligibility_note then
    update public.races set plan_source_updated_at = clock_timestamp() where id in (old.race_id, new.race_id);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists bump_start_wave_race_plan_source_revision_trigger on public.race_start_waves;
create trigger bump_start_wave_race_plan_source_revision_trigger
after insert or update or delete on public.race_start_waves
for each row execute function public.bump_start_wave_race_plan_source_revision();

-- Preserve SAS rows so saving an unchanged collection does not manufacture a
-- new official revision. The race row lock also serializes the schedule mirror.
create or replace function public.replace_race_start_waves(p_race_id uuid, p_items jsonb)
returns setof public.race_start_waves
language plpgsql
security invoker
set search_path = ''
as $$
declare
  locked_race_id uuid;
  current_organizer_details jsonb;
  next_organizer_details jsonb;
  first_time time;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Start-wave items must be a JSON array.' using errcode = '22023';
  end if;

  select race_row.id, race_row.organizer_details
  into locked_race_id, current_organizer_details
  from public.races race_row
  where race_row.id = p_race_id
  for update;
  if locked_race_id is null then raise exception 'Race not found.' using errcode = 'P0002'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) item(id uuid)
    where item.id is not null
    group by item.id
    having count(*) > 1
  ) then raise exception 'A start wave id may only be submitted once.' using errcode = '22023'; end if;

  update public.race_start_waves wave_row
  set name = item.name,
      start_time = item.start_time,
      eligibility_type = item.eligibility_type,
      bib_number_min = item.bib_number_min,
      bib_number_max = item.bib_number_max,
      finish_minutes_min = item.finish_minutes_min,
      finish_minutes_max = item.finish_minutes_max,
      pace_seconds_min = item.pace_seconds_min,
      pace_seconds_max = item.pace_seconds_max,
      eligibility_note = item.eligibility_note,
      order_index = item.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) item(
    id uuid, name text, start_time time, eligibility_type text,
    bib_number_min integer, bib_number_max integer,
    finish_minutes_min integer, finish_minutes_max integer,
    pace_seconds_min integer, pace_seconds_max integer,
    eligibility_note text, order_index integer
  )
  where wave_row.race_id = p_race_id
    and wave_row.id = item.id
    and (wave_row.name, wave_row.start_time, wave_row.eligibility_type,
      wave_row.bib_number_min, wave_row.bib_number_max,
      wave_row.finish_minutes_min, wave_row.finish_minutes_max,
      wave_row.pace_seconds_min, wave_row.pace_seconds_max,
      wave_row.eligibility_note, wave_row.order_index)
      is distinct from
      (item.name, item.start_time, item.eligibility_type,
        item.bib_number_min, item.bib_number_max,
        item.finish_minutes_min, item.finish_minutes_max,
        item.pace_seconds_min, item.pace_seconds_max,
        item.eligibility_note, item.order_index);

  delete from public.race_start_waves wave_row
  where wave_row.race_id = p_race_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) item(id uuid)
      where item.id = wave_row.id
    );

  insert into public.race_start_waves (
    id, race_id, name, start_time, eligibility_type,
    bib_number_min, bib_number_max, finish_minutes_min, finish_minutes_max,
    pace_seconds_min, pace_seconds_max, eligibility_note, order_index
  )
  select coalesce(item.id, gen_random_uuid()), p_race_id, item.name, item.start_time,
    item.eligibility_type, item.bib_number_min, item.bib_number_max,
    item.finish_minutes_min, item.finish_minutes_max,
    item.pace_seconds_min, item.pace_seconds_max, item.eligibility_note, item.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) item(
    id uuid, name text, start_time time, eligibility_type text,
    bib_number_min integer, bib_number_max integer,
    finish_minutes_min integer, finish_minutes_max integer,
    pace_seconds_min integer, pace_seconds_max integer,
    eligibility_note text, order_index integer
  )
  where item.id is null
    or not exists (select 1 from public.race_start_waves wave_row where wave_row.id = item.id);

  select min(wave_row.start_time) into first_time
  from public.race_start_waves wave_row where wave_row.race_id = p_race_id;
  if first_time is not null then
    next_organizer_details := jsonb_set(
      coalesce(current_organizer_details, '{}'::jsonb)
        || jsonb_build_object('schedule', coalesce(current_organizer_details -> 'schedule', '{}'::jsonb)),
      '{schedule,startTime}', to_jsonb(first_time::text), true
    );
    update public.races
    set organizer_details = next_organizer_details
    where id = p_race_id and organizer_details is distinct from next_organizer_details;
  end if;

  return query select wave_row.* from public.race_start_waves wave_row
  where wave_row.race_id = p_race_id order by wave_row.order_index;
end;
$$;

-- Preserve link rows and avoid delete/reinsert revision bumps when the submitted
-- official product collection is unchanged.
create or replace function public.replace_race_aid_station_products(
  p_race_id uuid,
  p_aid_station_id uuid,
  p_items jsonb
)
returns setof public.race_aid_station_products
language plpgsql
security invoker
set search_path = ''
as $$
declare
  locked_race_id uuid;
  locked_station_id uuid;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Aid station product items must be a JSON array.' using errcode = '22023';
  end if;
  select race_row.id into locked_race_id from public.races race_row where race_row.id = p_race_id for update;
  if locked_race_id is null then raise exception 'Race not found.' using errcode = 'P0002'; end if;
  select station.id into locked_station_id
  from public.race_aid_stations station
  where station.id = p_aid_station_id and station.race_id = p_race_id
  for update;
  if locked_station_id is null then raise exception 'Aid station does not belong to this race.' using errcode = '23503'; end if;
  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) item(product_id uuid)
    group by item.product_id having item.product_id is null or count(*) > 1
  ) then raise exception 'A product may only be submitted once and must have an id.' using errcode = '22023'; end if;

  update public.race_aid_station_products link_row
  set notes = item.notes, order_index = item.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) item(product_id uuid, notes text, order_index integer)
  where link_row.race_aid_station_id = p_aid_station_id
    and link_row.product_id = item.product_id
    and (link_row.notes is distinct from item.notes or link_row.order_index is distinct from item.order_index);

  delete from public.race_aid_station_products link_row
  where link_row.race_aid_station_id = p_aid_station_id
    and not exists (
      select 1 from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) item(product_id uuid)
      where item.product_id = link_row.product_id
    );

  insert into public.race_aid_station_products (race_aid_station_id, product_id, notes, order_index)
  select p_aid_station_id, item.product_id, item.notes, item.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) item(product_id uuid, notes text, order_index integer)
  where not exists (
    select 1 from public.race_aid_station_products link_row
    where link_row.race_aid_station_id = p_aid_station_id and link_row.product_id = item.product_id
  );

  return query
  select link_row.* from public.race_aid_station_products link_row
  where link_row.race_aid_station_id = p_aid_station_id
  order by link_row.order_index, link_row.id;
end;
$$;

drop trigger if exists bump_linked_product_race_plan_source_revisions_trigger on public.products;
create trigger bump_linked_product_race_plan_source_revisions_trigger
after update on public.products
for each row execute function public.bump_linked_product_race_plan_source_revisions();

create or replace function public.initialize_plan_source_review_revision()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.race_id is distinct from new.race_id then
    new.source_revision_at_last_review := null;
  end if;
  if new.race_id is not null
    and (tg_op = 'INSERT' or old.race_id is distinct from new.race_id) then
    select race_row.plan_source_updated_at
    into new.source_revision_at_last_review
    from public.races race_row
    where race_row.id = new.race_id;
  end if;
  return new;
end;
$$;

drop trigger if exists initialize_plan_source_review_revision_trigger on public.race_plans;
create trigger initialize_plan_source_review_revision_trigger
before insert or update of race_id on public.race_plans
for each row execute function public.initialize_plan_source_review_revision();

create or replace function public.acknowledge_race_plan_source_revision(p_plan_id uuid)
returns timestamptz
language sql
security invoker
set search_path = ''
as $$
  update public.race_plans plan_row
  set source_revision_at_last_review = race_row.plan_source_updated_at
  from public.races race_row
  where plan_row.id = p_plan_id
    and plan_row.user_id = (select auth.uid())
    and plan_row.race_id = race_row.id
  returning plan_row.source_revision_at_last_review;
$$;

revoke all on function public.bump_race_plan_source_revision() from public, anon, authenticated;
revoke all on function public.bump_aid_station_race_plan_source_revision() from public, anon, authenticated;
revoke all on function public.bump_aid_product_race_plan_source_revision() from public, anon, authenticated;
revoke all on function public.bump_linked_product_race_plan_source_revisions() from public, anon, authenticated;
revoke all on function public.bump_start_wave_race_plan_source_revision() from public, anon, authenticated;
revoke all on function public.initialize_plan_source_review_revision() from public, anon, authenticated;
revoke all on function public.acknowledge_race_plan_source_revision(uuid) from public, anon, authenticated;
grant execute on function public.acknowledge_race_plan_source_revision(uuid) to authenticated, service_role;

comment on column public.races.plan_source_updated_at is 'Latest official source revision that can require an attached runner plan review.';
comment on column public.race_plans.source_revision_at_last_review is 'Official source revision explicitly acknowledged after saving this plan.';

commit;
