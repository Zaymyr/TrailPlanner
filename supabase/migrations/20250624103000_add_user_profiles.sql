-- Create user_profiles to store profile details
create table if not exists public.user_profiles (
  user_id uuid primary key default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  full_name text,
  age integer,
  water_bag_liters numeric,
  constraint user_profiles_age_check check (age is null or age >= 0),
  constraint user_profiles_water_bag_check check (water_bag_liters is null or water_bag_liters >= 0)
);

create or replace function public.set_user_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_user_profiles_updated_at();

-- Favorites for nutrition products
create table if not exists public.user_favorite_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_favorite_products_user_product_key unique (user_id, product_id)
);

create index if not exists user_favorite_products_user_idx on public.user_favorite_products(user_id);
create index if not exists user_favorite_products_product_idx on public.user_favorite_products(product_id);

-- Row level security
alter table public.user_profiles enable row level security;
alter table public.user_favorite_products enable row level security;

-- Policies (Postgres doesn't support CREATE POLICY IF NOT EXISTS)
drop policy if exists "Users can view their profile" on public.user_profiles;
create policy "Users can view their profile" on public.user_profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can upsert their profile" on public.user_profiles;
create policy "Users can upsert their profile" on public.user_profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their profile" on public.user_profiles;
create policy "Users can update their profile" on public.user_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can view their favorite products" on public.user_favorite_products;
create policy "Users can view their favorite products" on public.user_favorite_products
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can manage their favorite products" on public.user_favorite_products;
create policy "Users can manage their favorite products" on public.user_favorite_products
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
