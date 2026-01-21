alter table if exists public.user_profiles
  add column if not exists is_coach boolean not null default false,
  add column if not exists coach_tier_id uuid references public.coach_tiers(id),
  add column if not exists coach_plan_name text;
