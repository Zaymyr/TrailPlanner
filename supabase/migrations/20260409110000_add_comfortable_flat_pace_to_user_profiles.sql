alter table if exists public.user_profiles
  add column if not exists comfortable_flat_pace_min_per_km numeric;

alter table if exists public.user_profiles
  drop constraint if exists user_profiles_comfortable_flat_pace_check;

alter table if exists public.user_profiles
  add constraint user_profiles_comfortable_flat_pace_check
  check (
    comfortable_flat_pace_min_per_km is null
    or comfortable_flat_pace_min_per_km > 0
  );
