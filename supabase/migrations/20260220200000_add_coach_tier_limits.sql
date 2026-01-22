alter table if exists public.coach_tiers
  add column if not exists plan_limit integer,
  add column if not exists favorite_limit integer,
  add column if not exists custom_product_limit integer,
  add column if not exists allow_export boolean,
  add column if not exists allow_auto_fill boolean,
  add column if not exists is_premium boolean;
