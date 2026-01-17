-- Add trial fields to user_profiles
alter table if exists public.user_profiles
  add column if not exists trial_started_at timestamptz;

alter table if exists public.user_profiles
  add column if not exists trial_ends_at timestamptz;

alter table if exists public.user_profiles
  add column if not exists trial_welcome_seen_at timestamptz;
