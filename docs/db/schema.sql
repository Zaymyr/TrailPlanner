-- Schema reference for Supabase
create extension if not exists "pgcrypto";

create table public.app_feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  subject text not null,
  detail text not null
);

create table public.race_plans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  user_id uuid not null default auth.uid(),
  name text not null,
  planner_values jsonb not null,
  elevation_profile jsonb not null default '[]'::jsonb
);

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

create table public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  slug text not null,
  sku text not null,
  name text not null,
  product_url text,
  calories_kcal numeric not null default 0,
  carbs_g numeric not null default 0,
  sodium_mg numeric not null default 0,
  protein_g numeric not null default 0,
  fat_g numeric not null default 0,
  is_live boolean not null default false,
  is_archived boolean not null default false,
  constraint products_slug_key unique (slug),
  constraint products_sku_key unique (sku)
);

create index products_slug_idx on public.products(slug);
create index products_is_live_idx on public.products(is_live);

create or replace function public.set_products_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row
execute function public.set_products_updated_at();

create table public.affiliate_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  merchant text not null,
  country_code char(2),
  affiliate_url text not null,
  active boolean not null default true,
  constraint affiliate_offers_product_country_key unique (product_id, merchant, country_code)
);

create index affiliate_offers_product_id_idx on public.affiliate_offers(product_id);
create index affiliate_offers_active_idx on public.affiliate_offers(active);

create or replace function public.set_affiliate_offers_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_affiliate_offers_updated_at on public.affiliate_offers;
create trigger set_affiliate_offers_updated_at
before update on public.affiliate_offers
for each row
execute function public.set_affiliate_offers_updated_at();

-- Row level security configuration
alter table public.app_feedback enable row level security;
alter table public.race_plans enable row level security;
alter table public.products enable row level security;
alter table public.affiliate_offers enable row level security;
alter table public.affiliate_click_events enable row level security;
alter table public.affiliate_events enable row level security;

-- Race plan policies
create policy "Users can view their race plans" on public.race_plans
  for select using (auth.uid() = user_id);

create policy "Users can insert their race plans" on public.race_plans
  for insert with check (auth.uid() = user_id);

create policy "Users can update their race plans" on public.race_plans
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their race plans" on public.race_plans
  for delete using (auth.uid() = user_id);

-- Product policies
create policy "Service role can manage products" on public.products
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Authenticated can read live products" on public.products
  for select
  using ((auth.role() = 'authenticated' and is_live = true and is_archived = false) or auth.role() = 'service_role');

-- Affiliate offer policies
create policy "Service role can manage affiliate offers" on public.affiliate_offers
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Authenticated can read active affiliate offers" on public.affiliate_offers
  for select
  using (
    (
      auth.role() = 'authenticated'
      and active = true
      and exists (
        select 1 from public.products p
        where p.id = affiliate_offers.product_id
          and p.is_live = true
          and p.is_archived = false
      )
    )
    or auth.role() = 'service_role'
  );

create policy "Service role can manage affiliate click events" on public.affiliate_click_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role can manage affiliate events" on public.affiliate_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Authenticated users can insert affiliate events" on public.affiliate_events
  for insert
  with check (
    auth.role() = 'authenticated'
    and (user_id is null or user_id = auth.uid())
  );

create table public.affiliate_click_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  offer_id uuid not null references public.affiliate_offers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  country_code char(2),
  ip_address text,
  user_agent text,
  referrer text
);

create index affiliate_click_events_offer_id_idx on public.affiliate_click_events(offer_id);

create type public.affiliate_event_type as enum ('popup_open', 'click');

create table public.affiliate_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  user_id uuid,
  session_id text not null,
  event_type public.affiliate_event_type not null,
  product_id uuid not null references public.products(id) on delete cascade,
  offer_id uuid references public.affiliate_offers(id) on delete set null,
  country_code char(2),
  merchant text,
  user_agent text,
  ip_address text
);

create index affiliate_events_product_id_idx on public.affiliate_events(product_id);
create index affiliate_events_offer_id_idx on public.affiliate_events(offer_id);
create index affiliate_events_session_id_idx on public.affiliate_events(session_id);
