alter table if exists public.user_profiles
  add column if not exists weight_kg numeric,
  add column if not exists height_cm integer;

alter table if exists public.user_profiles
  drop constraint if exists user_profiles_weight_kg_check,
  drop constraint if exists user_profiles_height_cm_check;

alter table if exists public.user_profiles
  add constraint user_profiles_weight_kg_check
    check (weight_kg is null or (weight_kg >= 20 and weight_kg <= 250)),
  add constraint user_profiles_height_cm_check
    check (height_cm is null or (height_cm >= 100 and height_cm <= 250));
