create table if not exists public.race_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  location text,
  distance_km numeric not null default 0,
  elevation_gain_m numeric not null default 0,
  source_url text,
  image_url text,
  gpx_path text not null,
  gpx_hash text not null,
  is_published boolean not null default true,
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

create table if not exists public.race_catalog_aid_stations (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.race_catalog(id) on delete cascade,
  name text not null,
  km numeric not null,
  water_available boolean not null default true,
  notes text,
  order_index int not null default 0
);

create table if not exists public.plan_aid_stations (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.race_plans(id) on delete cascade,
  name text not null,
  km numeric not null,
  water_available boolean not null default true,
  notes text,
  order_index int not null default 0
);

alter table public.race_plans
  add column if not exists catalog_race_id uuid references public.race_catalog(id);

alter table public.race_plans
  add column if not exists catalog_race_updated_at_at_import timestamptz;

alter table public.race_plans
  add column if not exists plan_gpx_path text;

alter table public.race_plans
  add column if not exists plan_course_stats jsonb not null default '{}'::jsonb;

create index if not exists race_catalog_is_published_idx on public.race_catalog(is_published);
create index if not exists race_catalog_aid_stations_race_order_idx on public.race_catalog_aid_stations(race_id, order_index);
create index if not exists plan_aid_stations_plan_order_idx on public.plan_aid_stations(plan_id, order_index);

alter table public.race_catalog enable row level security;
alter table public.race_catalog_aid_stations enable row level security;
alter table public.plan_aid_stations enable row level security;

drop policy if exists "Published races are viewable" on public.race_catalog;
create policy "Published races are viewable" on public.race_catalog
  for select using (is_published = true);

drop policy if exists "Published race aid stations are viewable" on public.race_catalog_aid_stations;
create policy "Published race aid stations are viewable" on public.race_catalog_aid_stations
  for select using (
    exists (
      select 1 from public.race_catalog
      where race_catalog.id = race_catalog_aid_stations.race_id
        and race_catalog.is_published = true
    )
  );

drop policy if exists "Users can view their plan aid stations" on public.plan_aid_stations;
create policy "Users can view their plan aid stations" on public.plan_aid_stations
  for select using (
    exists (
      select 1 from public.race_plans
      where race_plans.id = plan_aid_stations.plan_id
        and race_plans.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert their plan aid stations" on public.plan_aid_stations;
create policy "Users can insert their plan aid stations" on public.plan_aid_stations
  for insert with check (
    exists (
      select 1 from public.race_plans
      where race_plans.id = plan_aid_stations.plan_id
        and race_plans.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their plan aid stations" on public.plan_aid_stations;
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

drop policy if exists "Users can delete their plan aid stations" on public.plan_aid_stations;
create policy "Users can delete their plan aid stations" on public.plan_aid_stations
  for delete using (
    exists (
      select 1 from public.race_plans
      where race_plans.id = plan_aid_stations.plan_id
        and race_plans.user_id = auth.uid()
    )
  );
