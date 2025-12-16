create extension if not exists "pgcrypto";

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  slug text not null,
  sku text not null,
  name text not null,
  calories_kcal numeric not null default 0,
  carbs_g numeric not null default 0,
  protein_g numeric not null default 0,
  fat_g numeric not null default 0,
  is_live boolean not null default false,
  is_archived boolean not null default false,
  constraint products_slug_key unique (slug),
  constraint products_sku_key unique (sku)
);

create index if not exists products_slug_idx on public.products(slug);
create index if not exists products_is_live_idx on public.products(is_live);

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

create table if not exists public.affiliate_offers (
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

create index if not exists affiliate_offers_product_id_idx on public.affiliate_offers(product_id);
create index if not exists affiliate_offers_active_idx on public.affiliate_offers(active);

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

-- Row Level Security configuration
alter table public.products enable row level security;
alter table public.affiliate_offers enable row level security;

drop policy if exists "Service role can manage products" on public.products;
create policy "Service role can manage products" on public.products
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Authenticated can read live products" on public.products;
create policy "Authenticated can read live products" on public.products
  for select
  using ((auth.role() = 'authenticated' and is_live = true and is_archived = false) or auth.role() = 'service_role');

drop policy if exists "Service role can manage affiliate offers" on public.affiliate_offers;
create policy "Service role can manage affiliate offers" on public.affiliate_offers
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Authenticated can read active affiliate offers" on public.affiliate_offers;
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

-- Seed minimal data for reference/testing
insert into public.products (slug, sku, name, calories_kcal, carbs_g, protein_g, fat_g, is_live)
values ('test-gel', 'SKU-TEST-GEL', 'Test Energy Gel', 100, 25, 0, 0, true)
on conflict (slug) do nothing;

insert into public.affiliate_offers (product_id, merchant, country_code, affiliate_url, active)
select id, 'Example Merchant', null, 'https://example.com/products/test-gel', true
from public.products
where slug = 'test-gel'
on conflict (product_id, merchant, country_code) do nothing;
