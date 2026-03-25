create table if not exists public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  distance_km numeric not null,
  elevation_m numeric not null,
  goal text not null check (goal in ('comfort', 'good_time', 'performance')),
  eating_ease text check (eating_ease in ('hard', 'ok', 'easy')),
  sweat_level text check (sweat_level in ('a_lot', 'normal', 'little')),
  carbs_per_hour integer not null,
  water_per_hour integer not null,
  sodium_per_hour integer not null,
  created_at timestamptz not null default now()
);

alter table public.nutrition_plans enable row level security;

create policy "Users can insert their own nutrition plans"
  on public.nutrition_plans
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can view their own nutrition plans"
  on public.nutrition_plans
  for select
  to authenticated
  using (auth.uid() = user_id);
