-- Owner-scoped RaceBook gear checklist schema and privilege checks.
-- Run after 20260924140119_add_racebook_gear_checks.sql in a privileged test database.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_class
    where oid = 'public.racebook_gear_checks'::regclass
      and relrowsecurity
  ) then
    raise exception 'RaceBook gear checks must have RLS enabled.';
  end if;

  if has_table_privilege('anon', 'public.racebook_gear_checks', 'select')
    or has_table_privilege('anon', 'public.racebook_gear_checks', 'insert')
    or has_table_privilege('anon', 'public.racebook_gear_checks', 'delete') then
    raise exception 'Anonymous clients must not access RaceBook gear checks.';
  end if;

  if not has_table_privilege('authenticated', 'public.racebook_gear_checks', 'select,insert,delete') then
    raise exception 'Authenticated runners need select, insert and delete grants.';
  end if;

  if has_table_privilege('authenticated', 'public.racebook_gear_checks', 'update') then
    raise exception 'RaceBook gear checks are append/remove state and must not be directly updated.';
  end if;

  if not has_table_privilege('service_role', 'public.racebook_gear_checks', 'select,insert,update,delete') then
    raise exception 'service_role needs full RaceBook gear-check access.';
  end if;

  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'racebook_gear_checks'
      and roles = array['authenticated']::name[]
      and cmd in ('SELECT', 'INSERT', 'DELETE')
  ) <> 3 then
    raise exception 'Expected separate owner-scoped select, insert and delete policies.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.racebook_gear_checks'::regclass
      and contype = 'f'
      and confrelid = 'public.user_profiles'::regclass
      and confdeltype = 'c'
  ) then
    raise exception 'Gear checks must cascade with their user profile.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.racebook_gear_checks'::regclass
      and contype = 'f'
      and confrelid = 'public.races'::regclass
      and confdeltype = 'c'
  ) then
    raise exception 'Gear checks must cascade with their race.';
  end if;
end;
$$;

rollback;
