-- ============================================================
-- Refactor: race_catalog → races, race_catalog_aid_stations → race_aid_stations
-- Adds created_by + is_public to races table
-- Renames catalog_race_id → race_id in race_plans
-- Updates RLS policies accordingly
-- ============================================================

-- 1. Rename race_catalog → races
alter table public.race_catalog rename to races;

-- Update the trigger function name to match the new table
drop trigger if exists set_race_catalog_updated_at on public.races;
create or replace function public.set_races_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create trigger set_races_updated_at
before update on public.races
for each row
execute function public.set_races_updated_at();

-- 2. Add ownership columns to races
alter table public.races
  add column if not exists created_by uuid references auth.users(id) null;

alter table public.races
  add column if not exists is_public boolean not null default true;

-- All existing races (created by admins) are public without a specific user owner
update public.races
  set is_public = true
  where is_public is distinct from true;

-- 3. Rename race_catalog_aid_stations → race_aid_stations
alter table public.race_catalog_aid_stations rename to race_aid_stations;

-- 4. Rename catalog_race_id → race_id in race_plans
alter table public.race_plans
  rename column catalog_race_id to race_id;

-- Update the FK constraint name (drop old, add new)
alter table public.race_plans
  drop constraint if exists race_plans_catalog_race_id_fkey;

alter table public.race_plans
  add constraint race_plans_race_id_fkey
  foreign key (race_id) references public.races(id);

-- 5. Rename indexes that referenced old table names
drop index if exists public.race_catalog_is_published_idx;
drop index if exists public.race_catalog_is_live_idx;
drop index if exists public.race_catalog_aid_stations_race_order_idx;

create index if not exists races_is_live_idx on public.races(is_live);
create index if not exists races_is_public_idx on public.races(is_public);
create index if not exists race_aid_stations_race_order_idx on public.race_aid_stations(race_id, order_index);

-- 6. Update RLS on races table
alter table public.races enable row level security;

-- Drop all old policies
drop policy if exists "Live races are viewable" on public.races;
drop policy if exists "Admins can insert races" on public.races;
drop policy if exists "Admins can update races" on public.races;
drop policy if exists "Admins can delete races" on public.races;
drop policy if exists "Published races are viewable" on public.races;

-- SELECT: public races visible to all, private races visible only to their creator, admins see all
create policy "races_select" on public.races
  for select using (
    is_public = true
    or created_by = auth.uid()
    or exists (
      select 1 from public.user_profiles
      where user_profiles.user_id = auth.uid()
        and user_profiles.role = 'admin'
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    or (auth.jwt() ->> 'role') = 'admin'
  );

-- INSERT: any authenticated user can create a race
create policy "races_insert" on public.races
  for insert with check (auth.uid() is not null);

-- UPDATE: only the creator or an admin
create policy "races_update" on public.races
  for update using (
    created_by = auth.uid()
    or exists (
      select 1 from public.user_profiles
      where user_profiles.user_id = auth.uid()
        and user_profiles.role = 'admin'
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    or (auth.jwt() ->> 'role') = 'admin'
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1 from public.user_profiles
      where user_profiles.user_id = auth.uid()
        and user_profiles.role = 'admin'
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    or (auth.jwt() ->> 'role') = 'admin'
  );

-- DELETE: only the creator or an admin
create policy "races_delete" on public.races
  for delete using (
    created_by = auth.uid()
    or exists (
      select 1 from public.user_profiles
      where user_profiles.user_id = auth.uid()
        and user_profiles.role = 'admin'
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    or (auth.jwt() ->> 'role') = 'admin'
  );

-- 7. Update RLS on race_aid_stations
alter table public.race_aid_stations enable row level security;

drop policy if exists "Published race aid stations are viewable" on public.race_aid_stations;

create policy "race_aid_stations_select" on public.race_aid_stations
  for select using (
    exists (
      select 1 from public.races
      where races.id = race_aid_stations.race_id
        and (
          races.is_public = true
          or races.created_by = auth.uid()
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

-- Admins can manage aid stations
create policy "race_aid_stations_insert" on public.race_aid_stations
  for insert with check (
    exists (
      select 1 from public.races
      where races.id = race_aid_stations.race_id
        and (
          races.created_by = auth.uid()
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

create policy "race_aid_stations_update" on public.race_aid_stations
  for update using (
    exists (
      select 1 from public.races
      where races.id = race_aid_stations.race_id
        and (
          races.created_by = auth.uid()
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

create policy "race_aid_stations_delete" on public.race_aid_stations
  for delete using (
    exists (
      select 1 from public.races
      where races.id = race_aid_stations.race_id
        and (
          races.created_by = auth.uid()
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
