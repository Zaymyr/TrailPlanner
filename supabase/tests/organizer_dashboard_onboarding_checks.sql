-- Organizer dashboard onboarding schema checks.
-- Run after migrations in a privileged Supabase SQL editor or psql session.

begin;

do $$
declare
  column_is_nullable text;
  column_type text;
  onboarding_default text;
begin
  select is_nullable, data_type, column_default
  into column_is_nullable, column_type, onboarding_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'race_event_organizers'
    and column_name = 'dashboard_onboarding_completed_at';

  if column_type is distinct from 'timestamp with time zone' then
    raise exception 'Expected race_event_organizers.dashboard_onboarding_completed_at to be timestamptz.';
  end if;

  if column_is_nullable is distinct from 'YES' then
    raise exception 'Expected new organizer memberships to start with pending onboarding.';
  end if;

  if onboarding_default is not null then
    raise exception 'Expected organizer dashboard onboarding to default to null.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'race_event_organizers'
      and policyname = 'Users can view own organizer memberships'
  ) then
    raise exception 'Expected the existing owner-scoped membership read policy.';
  end if;
end $$;

rollback;
