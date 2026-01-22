-- Schema reference for Supabase
create extension if not exists "pgcrypto";

create type public.fuel_type as enum (
  'gel',
  'drink_mix',
  'electrolyte',
  'capsule',
  'bar',
  'real_food',
  'other'
);

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
  coach_id uuid references public.user_profiles(user_id),
  name text not null,
  planner_values jsonb not null,
  elevation_profile jsonb not null default '[]'::jsonb,
  catalog_race_id uuid references public.race_catalog(id),
  catalog_race_updated_at_at_import timestamptz,
  plan_gpx_path text,
  plan_course_stats jsonb not null default '{}'::jsonb
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

create index race_plans_coach_id_idx on public.race_plans(coach_id);

create table public.race_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  location text,
  location_text text,
  trace_provider text,
  trace_id bigint,
  distance_km numeric not null default 0,
  elevation_gain_m numeric not null default 0,
  elevation_loss_m numeric not null default 0,
  min_alt_m numeric,
  max_alt_m numeric,
  start_lat numeric,
  start_lng numeric,
  bounds_min_lat numeric,
  bounds_min_lng numeric,
  bounds_max_lat numeric,
  bounds_max_lng numeric,
  source_url text,
  external_site_url text,
  image_url text,
  thumbnail_url text,
  gpx_path text not null,
  gpx_hash text not null,
  gpx_storage_path text,
  gpx_sha256 text,
  is_published boolean not null default true,
  is_live boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint race_catalog_slug_key unique (slug)
);

create or replace function public.set_race_catalog_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_race_catalog_updated_at on public.race_catalog;
create trigger set_race_catalog_updated_at
before update on public.race_catalog
for each row
execute function public.set_race_catalog_updated_at();

create index race_catalog_is_published_idx on public.race_catalog(is_published);
create index race_catalog_is_live_idx on public.race_catalog(is_live);

create table public.race_catalog_aid_stations (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.race_catalog(id) on delete cascade,
  name text not null,
  km numeric not null,
  water_available boolean not null default true,
  notes text,
  order_index int not null default 0
);

create table public.plan_aid_stations (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.race_plans(id) on delete cascade,
  name text not null,
  km numeric not null,
  water_available boolean not null default true,
  notes text,
  order_index int not null default 0
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  slug text not null,
  sku text not null,
  name text not null,
  fuel_type public.fuel_type not null default 'other',
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
create index products_fuel_type_idx on public.products(fuel_type);

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

create table public.user_profiles (
  user_id uuid primary key default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  full_name text,
  role text,
  age integer,
  water_bag_liters numeric,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  trial_welcome_seen_at timestamptz,
  trial_expired_seen_at timestamptz,
  is_coach boolean not null default false,
  coach_tier_id uuid references public.coach_tiers(id),
  coach_plan_name text,
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

create table public.coach_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_limit integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint coach_tiers_name_key unique (name)
);

create table public.coach_coachees (
  coach_id uuid not null references public.user_profiles(user_id) on delete cascade,
  coachee_id uuid not null references public.user_profiles(user_id) on delete cascade,
  status text not null,
  invited_email text,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (coach_id, coachee_id)
);

create index coach_coachees_coach_id_idx on public.coach_coachees(coach_id);
create index coach_coachees_coachee_id_idx on public.coach_coachees(coachee_id);

create table public.coach_invites (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.user_profiles(user_id) on delete cascade,
  invite_email text not null,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  invitee_user_id uuid references auth.users(id)
);

create index coach_invites_coach_id_idx on public.coach_invites(coach_id);
create index coach_invites_invite_email_idx on public.coach_invites(invite_email);
create index coach_invites_invitee_user_id_idx on public.coach_invites(invitee_user_id);
create unique index coach_invites_coach_email_uidx on public.coach_invites(coach_id, invite_email);

create table public.coach_intake_targets (
  coachee_id uuid not null references public.user_profiles(user_id) on delete cascade,
  coach_id uuid not null references public.user_profiles(user_id) on delete cascade,
  carbs_per_hour numeric,
  water_ml_per_hour numeric,
  sodium_mg_per_hour numeric,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index coach_intake_targets_coach_coachee_uidx on public.coach_intake_targets(coach_id, coachee_id);
create index coach_intake_targets_coach_id_idx on public.coach_intake_targets(coach_id);
create index coach_intake_targets_coachee_id_idx on public.coach_intake_targets(coachee_id);

create or replace function public.set_coach_intake_targets_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_coach_intake_targets_updated_at on public.coach_intake_targets;
create trigger set_coach_intake_targets_updated_at
before update on public.coach_intake_targets
for each row
execute function public.set_coach_intake_targets_updated_at();

create table public.coach_comments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.user_profiles(user_id) on delete cascade,
  coachee_id uuid not null references public.user_profiles(user_id) on delete cascade,
  plan_id uuid not null references public.race_plans(id) on delete cascade,
  section_id text,
  aid_station_id text,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index coach_comments_plan_id_idx on public.coach_comments(plan_id);
create index coach_comments_coach_id_idx on public.coach_comments(coach_id);
create index coach_comments_coachee_id_idx on public.coach_comments(coachee_id);
create index coach_comments_section_id_idx on public.coach_comments(section_id);
create index coach_comments_aid_station_id_idx on public.coach_comments(aid_station_id);

create or replace function public.set_coach_comments_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_coach_comments_updated_at on public.coach_comments;
create trigger set_coach_comments_updated_at
before update on public.coach_comments
for each row
execute function public.set_coach_comments_updated_at();

create table public.user_favorite_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_favorite_products_user_product_key unique (user_id, product_id)
);

create index user_favorite_products_user_idx on public.user_favorite_products(user_id);
create index user_favorite_products_product_idx on public.user_favorite_products(product_id);

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  price_id text,
  plan_name text,
  current_period_end timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create index subscriptions_user_id_idx on public.subscriptions(user_id);
create index subscriptions_stripe_subscription_id_idx on public.subscriptions(stripe_subscription_id);

create or replace function public.set_subscriptions_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.set_subscriptions_updated_at();

create index race_catalog_is_published_idx on public.race_catalog(is_published);
create index race_catalog_aid_stations_race_order_idx on public.race_catalog_aid_stations(race_id, order_index);
create index plan_aid_stations_plan_order_idx on public.plan_aid_stations(plan_id, order_index);

-- Row level security configuration
alter table public.app_feedback enable row level security;
alter table public.race_plans enable row level security;
alter table public.race_catalog enable row level security;
alter table public.race_catalog_aid_stations enable row level security;
alter table public.plan_aid_stations enable row level security;
alter table public.products enable row level security;
alter table public.affiliate_offers enable row level security;
alter table public.affiliate_click_events enable row level security;
alter table public.affiliate_events enable row level security;
alter table public.user_profiles enable row level security;
alter table public.coach_tiers enable row level security;
alter table public.coach_coachees enable row level security;
alter table public.coach_invites enable row level security;
alter table public.coach_intake_targets enable row level security;
alter table public.coach_comments enable row level security;
alter table public.user_favorite_products enable row level security;
alter table public.subscriptions enable row level security;
-- Trace feature tables removed; see migrations for previous definitions.

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

create policy "Coaches can view their coachee race plans" on public.race_plans
  for select using (
    coach_id = auth.uid()
    and exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
    )
  );

create policy "Coaches can insert coachee race plans" on public.race_plans
  for insert with check (
    coach_id = auth.uid()
    and exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
    )
  );

create policy "Coaches can update coachee race plans" on public.race_plans
  for update using (
    coach_id = auth.uid()
    and exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
    )
  )
  with check (
    coach_id = auth.uid()
    and exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
    )
  );

create policy "Coaches can delete coachee race plans" on public.race_plans
  for delete using (
    coach_id = auth.uid()
    and exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
    )
  );

-- Race catalog policies
create policy "Published races are viewable" on public.race_catalog
  for select using (is_published = true);

create policy "Published race aid stations are viewable" on public.race_catalog_aid_stations
  for select using (
    exists (
      select 1 from public.race_catalog
      where race_catalog.id = race_catalog_aid_stations.race_id
        and race_catalog.is_published = true
    )
  );

create policy "Users can view their plan aid stations" on public.plan_aid_stations
  for select using (
    exists (
      select 1 from public.race_plans
      where race_plans.id = plan_aid_stations.plan_id
        and race_plans.user_id = auth.uid()
    )
  );

create policy "Users can insert their plan aid stations" on public.plan_aid_stations
  for insert with check (
    exists (
      select 1 from public.race_plans
      where race_plans.id = plan_aid_stations.plan_id
        and race_plans.user_id = auth.uid()
    )
  );

create policy "Users can update their plan aid stations" on public.plan_aid_stations
  for update using (
    exists (
      select 1 from public.race_plans
      where race_plans.id = plan_aid_stations.plan_id
        and race_plans.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.race_plans
      where race_plans.id = plan_aid_stations.plan_id
        and race_plans.user_id = auth.uid()
    )
  );

create policy "Users can delete their plan aid stations" on public.plan_aid_stations
  for delete using (
    exists (
      select 1 from public.race_plans
      where race_plans.id = plan_aid_stations.plan_id
        and race_plans.user_id = auth.uid()
    )
  );

-- Product policies
create policy "Service role can manage products" on public.products
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Authenticated can read live products" on public.products
  for select
  using ((auth.role() = 'authenticated' and is_live = true and is_archived = false) or auth.role() = 'service_role');

create policy "Anon can read live products" on public.products
  for select
  using (auth.role() = 'anon' and is_live = true and is_archived = false);

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

create policy "Users can view their profile" on public.user_profiles
  for select using (auth.uid() = user_id);

create policy "Users can insert their profile" on public.user_profiles
  for insert with check (auth.uid() = user_id);

create policy "Users can update their profile" on public.user_profiles
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Coaches and coachees can read their relationships" on public.coach_coachees
  for select using (coach_id = auth.uid() or coachee_id = auth.uid());

create policy "Coaches can insert their coachees" on public.coach_coachees
  for insert with check (coach_id = auth.uid());

create policy "Coaches can update their coachees" on public.coach_coachees
  for update using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

create policy "Coaches can delete their coachees" on public.coach_coachees
  for delete using (coach_id = auth.uid());

create policy "Coaches can read their invites" on public.coach_invites
  for select using (coach_id = auth.uid());

create policy "Invited users can read their invites" on public.coach_invites
  for select using (lower(invite_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "Coaches can insert invites" on public.coach_invites
  for insert with check (coach_id = auth.uid());

create policy "Coaches can update their invites" on public.coach_invites
  for update using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

create policy "Coaches can delete their invites" on public.coach_invites
  for delete using (coach_id = auth.uid());

create policy "Coaches can read their intake targets" on public.coach_intake_targets
  for select using (coach_id = auth.uid() or coachee_id = auth.uid());

create policy "Coaches can insert intake targets" on public.coach_intake_targets
  for insert with check (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = coach_intake_targets.coachee_id
    )
  );

create policy "Coaches can update intake targets" on public.coach_intake_targets
  for update using (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = coach_intake_targets.coachee_id
    )
  );

create policy "Coaches can delete intake targets" on public.coach_intake_targets
  for delete using (coach_id = auth.uid());

create policy "Coaches can manage coach comments" on public.coach_comments
  for all
  using (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = coach_comments.coachee_id
    )
    and exists (
      select 1
      from public.race_plans
      where race_plans.id = coach_comments.plan_id
        and race_plans.user_id = coach_comments.coachee_id
        and race_plans.coach_id = auth.uid()
    )
  )
  with check (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = coach_comments.coachee_id
    )
    and exists (
      select 1
      from public.race_plans
      where race_plans.id = coach_comments.plan_id
        and race_plans.user_id = coach_comments.coachee_id
        and race_plans.coach_id = auth.uid()
    )
  );

create policy "Coachees can read coach comments" on public.coach_comments
  for select
  using (
    coachee_id = auth.uid()
    and exists (
      select 1
      from public.race_plans
      where race_plans.id = coach_comments.plan_id
        and race_plans.user_id = auth.uid()
    )
  );

create policy "Authenticated users can read coach tiers" on public.coach_tiers
  for select
  using (auth.role() = 'authenticated');

create policy "Users can view their favorite products" on public.user_favorite_products
  for select using (auth.uid() = user_id);

create policy "Users can manage their favorite products" on public.user_favorite_products
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role can upsert subscriptions" on public.subscriptions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Users can read their subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

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
