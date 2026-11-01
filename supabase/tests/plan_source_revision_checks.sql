-- Official source revision triggers, no-op behavior and plan acknowledgment checks.
-- Run after 20261029110000_add_plan_source_revisions.sql in a privileged SQL session.

begin;

do $$
declare
  helper_signature regprocedure;
  helper_definition text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'races'
      and column_name = 'plan_source_updated_at'
      and data_type = 'timestamp with time zone' and is_nullable = 'NO'
  ) then raise exception 'races.plan_source_updated_at must be a required timestamptz.'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'race_plans'
      and column_name = 'source_revision_at_last_review'
      and data_type = 'timestamp with time zone'
  ) then raise exception 'race_plans.source_revision_at_last_review must be a timestamptz.'; end if;

  foreach helper_signature in array array[
    'public.bump_race_plan_source_revision()',
    'public.bump_aid_station_race_plan_source_revision()',
    'public.bump_aid_product_race_plan_source_revision()',
    'public.bump_linked_product_race_plan_source_revisions()',
    'public.bump_start_wave_race_plan_source_revision()',
    'public.initialize_plan_source_review_revision()'
  ] loop
    if (select prosecdef from pg_proc where oid = helper_signature) then
      raise exception '% must remain SECURITY INVOKER.', helper_signature;
    end if;
    if has_function_privilege('anon', helper_signature, 'execute')
      or has_function_privilege('authenticated', helper_signature, 'execute') then
      raise exception '% must not be directly executable by client roles.', helper_signature;
    end if;
  end loop;

  foreach helper_signature in array array[
    'public.bump_race_plan_source_revision()',
    'public.bump_aid_station_race_plan_source_revision()',
    'public.bump_aid_product_race_plan_source_revision()',
    'public.bump_linked_product_race_plan_source_revisions()',
    'public.bump_start_wave_race_plan_source_revision()',
    'public.initialize_plan_source_review_revision()'
  ] loop
    helper_definition := lower(pg_get_functiondef(helper_signature));
    if helper_definition not like '%is distinct from%' then
      raise exception '% must compare source values with null-safe no-op guards.', helper_signature;
    end if;
  end loop;

  if not exists (select 1 from pg_trigger where tgrelid = 'public.races'::regclass and tgname = 'bump_race_plan_source_revision_trigger' and not tgisinternal)
    or not exists (select 1 from pg_trigger where tgrelid = 'public.race_aid_stations'::regclass and tgname = 'bump_aid_station_race_plan_source_revision_trigger' and not tgisinternal)
    or not exists (select 1 from pg_trigger where tgrelid = 'public.race_aid_station_products'::regclass and tgname = 'bump_aid_product_race_plan_source_revision_trigger' and not tgisinternal)
    or not exists (select 1 from pg_trigger where tgrelid = 'public.products'::regclass and tgname = 'bump_linked_product_race_plan_source_revisions_trigger' and not tgisinternal)
    or not exists (select 1 from pg_trigger where tgrelid = 'public.race_start_waves'::regclass and tgname = 'bump_start_wave_race_plan_source_revision_trigger' and not tgisinternal)
    or not exists (select 1 from pg_trigger where tgrelid = 'public.race_plans'::regclass and tgname = 'initialize_plan_source_review_revision_trigger' and not tgisinternal) then
    raise exception 'A required plan-source revision trigger is missing.';
  end if;

  helper_definition := lower(pg_get_functiondef('public.replace_race_aid_station_products(uuid,uuid,jsonb)'::regprocedure));
  if helper_definition not like '%is distinct from%'
    or helper_definition not like '%update public.race_aid_station_products%'
    or helper_definition not like '%delete from public.race_aid_station_products%'
    or helper_definition not like '%insert into public.race_aid_station_products%' then
    raise exception 'Aid-product replacement must apply a no-op-safe diff, not unconditional replacement.';
  end if;

  helper_definition := lower(pg_get_functiondef('public.replace_race_start_waves(uuid,jsonb)'::regprocedure));
  if helper_definition not like '%is distinct from%'
    or helper_definition not like '%update public.race_start_waves%'
    or helper_definition not like '%delete from public.race_start_waves%'
    or helper_definition not like '%insert into public.race_start_waves%' then
    raise exception 'Start-wave replacement must apply a no-op-safe diff, not unconditional replacement.';
  end if;

  helper_signature := 'public.acknowledge_race_plan_source_revision(uuid)'::regprocedure;
  if (select prosecdef from pg_proc where oid = helper_signature) then
    raise exception '% must remain SECURITY INVOKER.', helper_signature;
  end if;
  if has_function_privilege('anon', helper_signature, 'execute')
    or not has_function_privilege('authenticated', helper_signature, 'execute') then
    raise exception 'Plan-source acknowledgment must be authenticated-only.';
  end if;
end $$;

create temp table _plan_source_revision_fixture (
  user_id uuid not null,
  race_a_id uuid not null,
  race_b_id uuid not null,
  station_id uuid,
  link_id uuid,
  product_id uuid,
  wave_id uuid,
  plan_id uuid
) on commit drop;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '10000000-0000-0000-0000-000000000098',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'plan-source-revision@example.test', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into _plan_source_revision_fixture (user_id, race_a_id, race_b_id)
select '10000000-0000-0000-0000-000000000098', (array_agg(id order by id))[1], (array_agg(id order by id))[2]
from (
  select id from public.races where distance_km > 2 order by id limit 2
) selected_races;

do $$
begin
  if not exists (select 1 from _plan_source_revision_fixture where race_a_id is not null and race_b_id is not null) then
    raise exception 'Plan source revision checks require two races longer than 2 km.';
  end if;
end $$;

with inserted_station as (
  insert into public.race_aid_stations (race_id, name, km, water_available, solid_available, assistance_allowed, notes, order_index)
  select race_a_id, 'Revision check station', 1, true, true, true, 'initial', 0 from _plan_source_revision_fixture
  returning id
)
update _plan_source_revision_fixture fixture set station_id = inserted_station.id from inserted_station;

do $$
declare before_revision timestamptz; after_revision timestamptz;
begin
  select plan_source_updated_at into before_revision from public.races where id = (select race_a_id from _plan_source_revision_fixture);
  update public.race_aid_stations set name = name where id = (select station_id from _plan_source_revision_fixture);
  select plan_source_updated_at into after_revision from public.races where id = (select race_a_id from _plan_source_revision_fixture);
  if after_revision is distinct from before_revision then raise exception 'No-op aid-station updates must not bump the source revision.'; end if;

  update public.race_aid_stations set km = km + 0.1 where id = (select station_id from _plan_source_revision_fixture);
  select plan_source_updated_at into after_revision from public.races where id = (select race_a_id from _plan_source_revision_fixture);
  if after_revision <= before_revision then raise exception 'Meaningful aid-station updates must bump the source revision.'; end if;
end $$;

do $$
declare race_a_before timestamptz; race_b_before timestamptz;
begin
  select plan_source_updated_at into race_a_before from public.races where id = (select race_a_id from _plan_source_revision_fixture);
  select plan_source_updated_at into race_b_before from public.races where id = (select race_b_id from _plan_source_revision_fixture);
  update public.race_aid_stations set race_id = (select race_b_id from _plan_source_revision_fixture) where id = (select station_id from _plan_source_revision_fixture);
  if (select plan_source_updated_at from public.races where id = (select race_a_id from _plan_source_revision_fixture)) <= race_a_before
    or (select plan_source_updated_at from public.races where id = (select race_b_id from _plan_source_revision_fixture)) <= race_b_before then
    raise exception 'Moving an aid station must bump both old and new race revisions.';
  end if;
end $$;

do $$
declare before_revision timestamptz; after_revision timestamptz;
begin
  select plan_source_updated_at into before_revision from public.races where id = (select race_b_id from _plan_source_revision_fixture);
  update public.races set name = name where id = (select race_b_id from _plan_source_revision_fixture);
  select plan_source_updated_at into after_revision from public.races where id = (select race_b_id from _plan_source_revision_fixture);
  if after_revision is distinct from before_revision then raise exception 'No-op race updates must not bump the source revision.'; end if;
  update public.races set organizer_details = coalesce(organizer_details, '{}'::jsonb) || jsonb_build_object('_revision_check', true)
  where id = (select race_b_id from _plan_source_revision_fixture);
  select plan_source_updated_at into after_revision from public.races where id = (select race_b_id from _plan_source_revision_fixture);
  if after_revision <= before_revision then raise exception 'Meaningful race updates must bump the source revision.'; end if;
end $$;

with inserted_product as (
  insert into public.products (slug, sku, name, calories_kcal, carbs_g, protein_g, fat_g, is_live, is_archived)
  values ('revision-product-' || replace(gen_random_uuid()::text, '-', ''), 'revision-product-' || replace(gen_random_uuid()::text, '-', ''), 'Revision product', 100, 25, 0, 0, false, false)
  returning id
), inserted_link as (
  insert into public.race_aid_station_products (race_aid_station_id, product_id, notes, order_index)
  select fixture.station_id, product.id, 'initial', 0 from _plan_source_revision_fixture fixture cross join inserted_product product
  returning id, product_id
)
update _plan_source_revision_fixture fixture set product_id = inserted_link.product_id, link_id = inserted_link.id from inserted_link;

do $$
declare before_revision timestamptz; after_revision timestamptz;
begin
  select plan_source_updated_at into before_revision from public.races where id = (select race_b_id from _plan_source_revision_fixture);
  update public.race_aid_station_products set notes = notes where id = (select link_id from _plan_source_revision_fixture);
  perform public.replace_race_aid_station_products(
    (select race_b_id from _plan_source_revision_fixture), (select station_id from _plan_source_revision_fixture),
    jsonb_build_array(jsonb_build_object('product_id', (select product_id from _plan_source_revision_fixture), 'notes', 'initial', 'order_index', 0))
  );
  select plan_source_updated_at into after_revision from public.races where id = (select race_b_id from _plan_source_revision_fixture);
  if after_revision is distinct from before_revision then raise exception 'No-op product-link writes must not bump the source revision.'; end if;

  update public.race_aid_station_products set notes = 'changed' where id = (select link_id from _plan_source_revision_fixture);
  select plan_source_updated_at into after_revision from public.races where id = (select race_b_id from _plan_source_revision_fixture);
  if after_revision <= before_revision then raise exception 'Meaningful product-link updates must bump the source revision.'; end if;

  before_revision := after_revision;
  update public.products set name = name where id = (select product_id from _plan_source_revision_fixture);
  select plan_source_updated_at into after_revision from public.races where id = (select race_b_id from _plan_source_revision_fixture);
  if after_revision is distinct from before_revision then raise exception 'No-op linked-product updates must not bump the source revision.'; end if;
  update public.products set sodium_mg = coalesce(sodium_mg, 0) + 1 where id = (select product_id from _plan_source_revision_fixture);
  select plan_source_updated_at into after_revision from public.races where id = (select race_b_id from _plan_source_revision_fixture);
  if after_revision <= before_revision then raise exception 'Meaningful linked-product updates must bump the source revision.'; end if;
end $$;

with inserted_wave as (
  insert into public.race_start_waves (race_id, name, start_time, eligibility_type, order_index)
  select race_b_id, 'Revision check wave', '08:00'::time, 'all', 0 from _plan_source_revision_fixture returning id
)
update _plan_source_revision_fixture fixture set wave_id = inserted_wave.id from inserted_wave;

do $$
declare before_revision timestamptz; after_revision timestamptz;
begin
  update public.races
  set organizer_details = jsonb_set(
    coalesce(organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(organizer_details -> 'schedule', '{}'::jsonb)),
    '{schedule,startTime}', to_jsonb('08:00:00'::text), true
  )
  where id = (select race_b_id from _plan_source_revision_fixture);
  select plan_source_updated_at into before_revision from public.races where id = (select race_b_id from _plan_source_revision_fixture);
  update public.race_start_waves set start_time = start_time where id = (select wave_id from _plan_source_revision_fixture);
  perform public.replace_race_start_waves(
    (select race_b_id from _plan_source_revision_fixture),
    jsonb_build_array(jsonb_build_object(
      'id', (select wave_id from _plan_source_revision_fixture),
      'name', 'Revision check wave', 'start_time', '08:00:00',
      'eligibility_type', 'all', 'order_index', 0
    ))
  );
  select plan_source_updated_at into after_revision from public.races where id = (select race_b_id from _plan_source_revision_fixture);
  if after_revision is distinct from before_revision then raise exception 'No-op start-wave updates and replacements must not bump the source revision.'; end if;
  update public.race_start_waves set start_time = '08:01'::time where id = (select wave_id from _plan_source_revision_fixture);
  select plan_source_updated_at into after_revision from public.races where id = (select race_b_id from _plan_source_revision_fixture);
  if after_revision <= before_revision then raise exception 'Meaningful start-wave updates must bump the source revision.'; end if;
end $$;

with inserted_plan as (
  insert into public.race_plans (user_id, name, planner_values, elevation_profile, race_id)
  select user_id, 'Revision check plan', '{}'::jsonb, '[]'::jsonb, race_a_id from _plan_source_revision_fixture returning id
)
update _plan_source_revision_fixture fixture set plan_id = inserted_plan.id from inserted_plan;

do $$
declare reviewed_revision timestamptz; acknowledged_revision timestamptz;
begin
  if (select source_revision_at_last_review from public.race_plans where id = (select plan_id from _plan_source_revision_fixture))
    is distinct from (select plan_source_updated_at from public.races where id = (select race_a_id from _plan_source_revision_fixture)) then
    raise exception 'New linked plans must acknowledge their current source revision.';
  end if;
  update public.race_plans set race_id = (select race_b_id from _plan_source_revision_fixture) where id = (select plan_id from _plan_source_revision_fixture);
  select source_revision_at_last_review into reviewed_revision from public.race_plans where id = (select plan_id from _plan_source_revision_fixture);
  if reviewed_revision is distinct from (select plan_source_updated_at from public.races where id = (select race_b_id from _plan_source_revision_fixture)) then
    raise exception 'Re-linking a plan must reset its acknowledged source revision to the new race.';
  end if;

  update public.races
  set distance_km = distance_km + 0.01
  where id = (select race_b_id from _plan_source_revision_fixture);
  perform set_config(
    'request.jwt.claim.sub',
    (select user_id::text from _plan_source_revision_fixture),
    true
  );
  select public.acknowledge_race_plan_source_revision((select plan_id from _plan_source_revision_fixture))
  into acknowledged_revision;
  if acknowledged_revision is distinct from (select plan_source_updated_at from public.races where id = (select race_b_id from _plan_source_revision_fixture)) then
    raise exception 'Explicit acknowledgment must atomically store the current official revision.';
  end if;
end $$;

rollback;
