create table if not exists public.coach_profiles (
  user_id uuid primary key references public.user_profiles(user_id) on delete cascade,
  coach_tier_id uuid references public.coach_tiers(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists coach_profiles_stripe_customer_id_idx on public.coach_profiles(stripe_customer_id);
create unique index if not exists coach_profiles_stripe_subscription_id_idx on public.coach_profiles(stripe_subscription_id);

create or replace function public.set_coach_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_coach_profiles_updated_at on public.coach_profiles;
create trigger set_coach_profiles_updated_at
before update on public.coach_profiles
for each row
execute function public.set_coach_profiles_updated_at();

alter table public.coach_profiles enable row level security;

drop policy if exists "Service role can upsert coach profiles" on public.coach_profiles;
create policy "Service role can upsert coach profiles" on public.coach_profiles
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Users can read their coach profile" on public.coach_profiles;
create policy "Users can read their coach profile" on public.coach_profiles
  for select using (auth.uid() = user_id);
