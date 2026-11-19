-- Livret supporter guided tour, the supporter counterpart of racebook_onboarding_status.
-- Additive: existing app builds keep reading and writing the two runner columns only.
alter table public.user_profiles
  add column if not exists supporter_onboarding_status text not null default 'pending';

alter table public.user_profiles
  drop constraint if exists user_profiles_supporter_onboarding_status_check,
  add constraint user_profiles_supporter_onboarding_status_check
    check (supporter_onboarding_status in ('pending', 'in_progress', 'skipped', 'completed'));

comment on column public.user_profiles.supporter_onboarding_status is
  'Supporter-facing mobile Livret supporter onboarding state: pending, in_progress, skipped, or completed.';
