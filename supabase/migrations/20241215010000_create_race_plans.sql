-- Store saved race plans tied to authenticated Supabase users
create extension if not exists "pgcrypto";

create table if not exists public.race_plans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  user_id uuid not null default auth.uid(),
  name text not null,
  planner_values jsonb not null,
  elevation_profile jsonb not null default '[]'::jsonb
);

create index if not exists race_plans_user_id_idx on public.race_plans(user_id);

alter table public.race_plans enable row level security;

create policy if not exists "Users can view their race plans" on public.race_plans
  for select using (auth.uid() = user_id);

create policy if not exists "Users can insert their race plans" on public.race_plans
  for insert with check (auth.uid() = user_id);

create policy if not exists "Users can update their race plans" on public.race_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists "Users can delete their race plans" on public.race_plans
  for delete using (auth.uid() = user_id);

create or replace function public.set_race_plans_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_race_plans_updated_at on public.race_plans;

create trigger set_race_plans_updated_at
before update on public.race_plans
for each row
execute function public.set_race_plans_updated_at();
