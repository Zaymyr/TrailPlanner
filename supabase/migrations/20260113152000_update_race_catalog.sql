alter table public.user_profiles
  add column if not exists role text;

alter table public.race_catalog
  add column if not exists is_live boolean not null default true;

alter table public.race_catalog
  add column if not exists location_text text;

alter table public.race_catalog
  add column if not exists trace_provider text;

alter table public.race_catalog
  add column if not exists trace_id bigint;

alter table public.race_catalog
  add column if not exists gpx_storage_path text;

alter table public.race_catalog
  add column if not exists gpx_sha256 text;

alter table public.race_catalog
  add column if not exists elevation_loss_m numeric not null default 0;

alter table public.race_catalog
  add column if not exists min_alt_m numeric;

alter table public.race_catalog
  add column if not exists max_alt_m numeric;

alter table public.race_catalog
  add column if not exists start_lat numeric;

alter table public.race_catalog
  add column if not exists start_lng numeric;

alter table public.race_catalog
  add column if not exists bounds_min_lat numeric;

alter table public.race_catalog
  add column if not exists bounds_min_lng numeric;

alter table public.race_catalog
  add column if not exists bounds_max_lat numeric;

alter table public.race_catalog
  add column if not exists bounds_max_lng numeric;

alter table public.race_catalog
  add column if not exists thumbnail_url text;

alter table public.race_catalog
  add column if not exists external_site_url text;

alter table public.race_catalog
  add column if not exists notes text;

update public.race_catalog
  set is_live = is_published
  where is_live is distinct from is_published;

update public.race_catalog
  set location_text = location
  where location_text is null and location is not null;

update public.race_catalog
  set gpx_storage_path = gpx_path
  where gpx_storage_path is null and gpx_path is not null;

update public.race_catalog
  set gpx_sha256 = gpx_hash
  where gpx_sha256 is null and gpx_hash is not null;

update public.race_catalog
  set thumbnail_url = image_url
  where thumbnail_url is null and image_url is not null;

update public.race_catalog
  set external_site_url = source_url
  where external_site_url is null and source_url is not null;

create index if not exists race_catalog_is_live_idx on public.race_catalog(is_live);

alter table public.race_catalog enable row level security;

drop policy if exists "Live races are viewable" on public.race_catalog;
create policy "Live races are viewable" on public.race_catalog
  for select using (
    is_live = true
    or exists (
      select 1 from public.user_profiles
      where user_profiles.user_id = auth.uid()
        and user_profiles.role = 'admin'
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    or (auth.jwt() ->> 'role') = 'admin'
  );

drop policy if exists "Admins can insert races" on public.race_catalog;
create policy "Admins can insert races" on public.race_catalog
  for insert with check (
    exists (
      select 1 from public.user_profiles
      where user_profiles.user_id = auth.uid()
        and user_profiles.role = 'admin'
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    or (auth.jwt() ->> 'role') = 'admin'
  );

drop policy if exists "Admins can update races" on public.race_catalog;
create policy "Admins can update races" on public.race_catalog
  for update using (
    exists (
      select 1 from public.user_profiles
      where user_profiles.user_id = auth.uid()
        and user_profiles.role = 'admin'
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    or (auth.jwt() ->> 'role') = 'admin'
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where user_profiles.user_id = auth.uid()
        and user_profiles.role = 'admin'
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    or (auth.jwt() ->> 'role') = 'admin'
  );

drop policy if exists "Admins can delete races" on public.race_catalog;
create policy "Admins can delete races" on public.race_catalog
  for delete using (
    exists (
      select 1 from public.user_profiles
      where user_profiles.user_id = auth.uid()
        and user_profiles.role = 'admin'
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    or (auth.jwt() ->> 'role') = 'admin'
  );

drop policy if exists "Published races are viewable" on public.race_catalog;

drop policy if exists "Published race aid stations are viewable" on public.race_catalog_aid_stations;
create policy "Published race aid stations are viewable" on public.race_catalog_aid_stations
  for select using (
    exists (
      select 1 from public.race_catalog
      where race_catalog.id = race_catalog_aid_stations.race_id
        and (
          race_catalog.is_live = true
          or exists (
            select 1 from public.user_profiles
            where user_profiles.user_id = auth.uid()
              and user_profiles.role = 'admin'
          )
          or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
          or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
          or (auth.jwt() ->> 'role') = 'admin'
        )
    )
  );
