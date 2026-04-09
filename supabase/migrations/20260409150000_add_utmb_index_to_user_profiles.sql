alter table public.user_profiles
  add column if not exists utmb_index numeric;

alter table public.user_profiles
  drop constraint if exists user_profiles_utmb_index_check;

alter table public.user_profiles
  add constraint user_profiles_utmb_index_check
  check (utmb_index is null or (utmb_index >= 0 and utmb_index <= 2000));
