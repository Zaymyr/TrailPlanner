alter table if exists public.subscriptions
  add column if not exists plan_name text;
