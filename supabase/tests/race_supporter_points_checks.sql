-- Supporter point schema, RLS and service-only mutation checks.
-- Run after 20261029091807_add_race_supporter_points.sql.

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

rollback;
