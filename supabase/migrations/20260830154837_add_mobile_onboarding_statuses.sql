alter table public.user_profiles
  add column if not exists plan_onboarding_status text,
  add column if not exists racebook_onboarding_status text;

update public.user_profiles as profile
set plan_onboarding_status = coalesce(profile.plan_onboarding_status, 'completed'),
    racebook_onboarding_status = coalesce(profile.racebook_onboarding_status, 'pending')
where profile.plan_onboarding_status is null
   or profile.racebook_onboarding_status is null;

alter table public.user_profiles
  alter column plan_onboarding_status set default 'pending',
  alter column plan_onboarding_status set not null,
  alter column racebook_onboarding_status set default 'pending',
  alter column racebook_onboarding_status set not null;

alter table public.user_profiles
  drop constraint if exists user_profiles_plan_onboarding_status_check,
  add constraint user_profiles_plan_onboarding_status_check
    check (plan_onboarding_status in ('pending', 'in_progress', 'skipped', 'completed')),
  drop constraint if exists user_profiles_racebook_onboarding_status_check,
  add constraint user_profiles_racebook_onboarding_status_check
    check (racebook_onboarding_status in ('pending', 'in_progress', 'skipped', 'completed'));

comment on column public.user_profiles.plan_onboarding_status is
  'Runner-facing mobile plan onboarding state: pending, in_progress, skipped, or completed.';

comment on column public.user_profiles.racebook_onboarding_status is
  'Runner-facing mobile RaceBook onboarding state: pending, in_progress, skipped, or completed.';
