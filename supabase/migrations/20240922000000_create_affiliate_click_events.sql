create table if not exists public.affiliate_click_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  offer_id uuid not null references public.affiliate_offers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  country_code char(2),
  ip_address text,
  user_agent text,
  referrer text
);

create index if not exists affiliate_click_events_offer_id_idx on public.affiliate_click_events(offer_id);

alter table public.affiliate_click_events enable row level security;

drop policy if exists "Service role can manage affiliate click events" on public.affiliate_click_events;
create policy "Service role can manage affiliate click events" on public.affiliate_click_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
