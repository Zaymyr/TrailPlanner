alter table if exists public.user_profiles
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.user_profiles.onboarding_completed_at is
  'When the runner completed or explicitly skipped the required mobile onboarding.';
