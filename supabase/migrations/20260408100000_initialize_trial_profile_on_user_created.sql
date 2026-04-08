-- Ensure every new auth user gets a profile row and a Premium trial immediately.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  trial_start timestamptz := coalesce(new.created_at, timezone('utc', now()));
  profile_name text := nullif(
    trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')),
    ''
  );
begin
  insert into public.user_profiles (user_id, full_name, trial_started_at, trial_ends_at)
  values (new.id, profile_name, trial_start, trial_start + interval '15 days')
  on conflict (user_id) do update
  set
    full_name = coalesce(public.user_profiles.full_name, excluded.full_name),
    trial_started_at = coalesce(public.user_profiles.trial_started_at, excluded.trial_started_at),
    trial_ends_at = coalesce(
      public.user_profiles.trial_ends_at,
      coalesce(public.user_profiles.trial_started_at, excluded.trial_started_at) + interval '15 days'
    );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

-- Backfill users who were created before the trigger existed.
insert into public.user_profiles (user_id, full_name, trial_started_at, trial_ends_at)
select
  users.id,
  nullif(
    trim(coalesce(users.raw_user_meta_data ->> 'full_name', users.raw_user_meta_data ->> 'name', '')),
    ''
  ),
  coalesce(users.created_at, timezone('utc', now())),
  coalesce(users.created_at, timezone('utc', now())) + interval '15 days'
from auth.users as users
on conflict (user_id) do update
set
  full_name = coalesce(public.user_profiles.full_name, excluded.full_name),
  trial_started_at = coalesce(public.user_profiles.trial_started_at, excluded.trial_started_at),
  trial_ends_at = coalesce(
    public.user_profiles.trial_ends_at,
    coalesce(public.user_profiles.trial_started_at, excluded.trial_started_at) + interval '15 days'
  )
where
  public.user_profiles.full_name is null
  or public.user_profiles.trial_started_at is null
  or public.user_profiles.trial_ends_at is null;
