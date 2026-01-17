alter table if exists public.user_profiles
  add column if not exists trial_expired_seen_at timestamptz;
