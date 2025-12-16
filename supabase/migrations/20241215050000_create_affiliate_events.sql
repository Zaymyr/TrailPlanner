create extension if not exists "pgcrypto";

create type if not exists public.affiliate_event_type as enum ('popup_open', 'click');

alter table if exists public.products add column if not exists sodium_mg numeric not null default 0;

create table if not exists public.affiliate_events (
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

create index if not exists affiliate_events_product_id_idx on public.affiliate_events(product_id);
create index if not exists affiliate_events_offer_id_idx on public.affiliate_events(offer_id);
create index if not exists affiliate_events_session_id_idx on public.affiliate_events(session_id);

alter table public.affiliate_events enable row level security;

-- Policies

drop policy if exists "Service role can manage affiliate events" on public.affiliate_events;
create policy "Service role can manage affiliate events" on public.affiliate_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Authenticated users can insert affiliate events" on public.affiliate_events;
create policy "Authenticated users can insert affiliate events" on public.affiliate_events
  for insert
  with check (
    auth.role() = 'authenticated'
    and (user_id is null or user_id = auth.uid())
  );

-- Seed sample products and offers for affiliate flows
insert into public.products (slug, sku, name, calories_kcal, carbs_g, protein_g, fat_g, sodium_mg, is_live)
values
  ('maurten-gel-100', 'SKU-MAURTEN-GEL-100', 'Maurten Gel 100', 100, 25, 0, 0, 85, true),
  ('gu-energy-gel', 'SKU-GU-ENERGY-GEL', 'GU Energy Gel', 90, 22, 0, 0, 60, true),
  ('sis-go-isotonic-gel', 'SKU-SIS-ISOTONIC-GEL', 'SIS GO Isotonic Gel', 87, 22, 0, 0, 10, true)
on conflict (slug) do update set
  calories_kcal = excluded.calories_kcal,
  carbs_g = excluded.carbs_g,
  protein_g = excluded.protein_g,
  fat_g = excluded.fat_g,
  sodium_mg = excluded.sodium_mg,
  is_live = excluded.is_live;

insert into public.affiliate_offers (product_id, merchant, country_code, affiliate_url, active)
select p.id, 'Example Merchant', null, 'https://example.com/products/' || p.slug, true
from public.products p
where p.slug in ('maurten-gel-100', 'gu-energy-gel', 'sis-go-isotonic-gel')
on conflict (product_id, merchant, country_code) do update set
  affiliate_url = excluded.affiliate_url,
  active = excluded.active;
