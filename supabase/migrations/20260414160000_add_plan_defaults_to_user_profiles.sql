alter table if exists public.user_profiles
  add column if not exists default_carbs_g_per_hour integer,
  add column if not exists default_water_ml_per_hour integer,
  add column if not exists default_sodium_mg_per_hour integer;

alter table if exists public.user_profiles
  drop constraint if exists user_profiles_default_carbs_g_per_hour_check,
  drop constraint if exists user_profiles_default_water_ml_per_hour_check,
  drop constraint if exists user_profiles_default_sodium_mg_per_hour_check;

alter table if exists public.user_profiles
  add constraint user_profiles_default_carbs_g_per_hour_check
    check (default_carbs_g_per_hour is null or default_carbs_g_per_hour >= 0),
  add constraint user_profiles_default_water_ml_per_hour_check
    check (default_water_ml_per_hour is null or default_water_ml_per_hour >= 0),
  add constraint user_profiles_default_sodium_mg_per_hour_check
    check (default_sodium_mg_per_hour is null or default_sodium_mg_per_hour >= 0);
