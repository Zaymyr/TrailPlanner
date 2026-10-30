-- Supporter point schema, RLS and service-only mutation checks.
-- Run after 20261029155052_fix_supporter_point_replacement_ordinality.sql.

begin;

do $$
begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.race_supporter_points'::regclass and relrowsecurity
  ) then raise exception 'race_supporter_points must have RLS enabled.'; end if;

  if not has_table_privilege('anon', 'public.race_supporter_points', 'select')
    or not has_table_privilege('authenticated', 'public.race_supporter_points', 'select') then
    raise exception 'Client roles require read-only access.';
  end if;
  if has_table_privilege('anon', 'public.race_supporter_points', 'insert,update,delete')
    or has_table_privilege('authenticated', 'public.race_supporter_points', 'insert,update,delete') then
    raise exception 'Client roles must not write supporter points.';
  end if;
  if not has_table_privilege('service_role', 'public.race_supporter_points', 'select,insert,update,delete') then
    raise exception 'service_role requires full supporter point access.';
  end if;

  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'race_supporter_points' and cmd = 'SELECT') <> 1 then
    raise exception 'Expected one public completeness/module SELECT policy.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.race_supporter_points'::regclass
      and contype = 'f' and confrelid = 'public.races'::regclass and confdeltype = 'c'
  ) then raise exception 'Supporter points must cascade with their race.'; end if;

  if has_function_privilege('anon', 'public.replace_race_supporter_points(uuid,jsonb)', 'execute')
    or has_function_privilege('authenticated', 'public.replace_race_supporter_points(uuid,jsonb)', 'execute') then
    raise exception 'Atomic replacement must be service-only.';
  end if;
  if not has_function_privilege('service_role', 'public.replace_race_supporter_points(uuid,jsonb)', 'execute') then
    raise exception 'service_role must execute atomic replacement.';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.race_supporter_points'::regclass
      and tgname = 'set_race_supporter_point_updated_at_trigger'
      and not tgisinternal
  ) then raise exception 'Supporter points require the updated_at trigger.'; end if;

  if position('supporter_points' in pg_get_constraintdef(
    (select oid from pg_constraint where conname = 'organizer_racebook_module_settings_scope_check')
  )) = 0 then raise exception 'Organizer module constraint must accept supporter_points.'; end if;
end;
$$;

create temp table _supporter_point_fixture (race_id uuid not null) on commit drop;

insert into _supporter_point_fixture (race_id)
select race_row.id
from public.races race_row
where race_row.distance_km >= 2
limit 1;

do $$
begin
  if not exists (select 1 from _supporter_point_fixture) then
    raise exception 'Supporter point checks require one race of at least 2 km.';
  end if;
end;
$$;

select public.replace_race_supporter_points(
  (select race_id from _supporter_point_fixture),
  jsonb_build_array(
    jsonb_build_object(
      'name', 'Second submitted', 'km', 1, 'encouragement_allowed', true,
      'latitude', 45.1, 'longitude', 4.1, 'access_on_course', true
    ),
    jsonb_build_object(
      'name', 'First submitted', 'km', 1, 'assistance_allowed', true,
      'latitude', 45.2, 'longitude', 4.2, 'access_on_course', false
    )
  )
);

do $$
begin
  if (select count(*) from public.race_supporter_points where race_id = (select race_id from _supporter_point_fixture)) <> 2 then
    raise exception 'Atomic replacement must persist every submitted supporter point.';
  end if;
  if not exists (
    select 1 from public.race_supporter_points
    where race_id = (select race_id from _supporter_point_fixture)
      and name = 'Second submitted' and order_index = 0 and access_on_course
  ) then
    raise exception 'Replacement must preserve equal-kilometer input order and access mode.';
  end if;
end;
$$;

rollback;
