alter table public.races
  add column if not exists participation_mode text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'races_participation_mode_check'
      and conrelid = 'public.races'::regclass
  ) then
    alter table public.races
      add constraint races_participation_mode_check
      check (participation_mode is null or participation_mode in ('solo', 'relay', 'solo_and_relay'));
  end if;
end $$;

comment on column public.races.participation_mode is
  'Runner-facing participation availability. Null means the organizer has not confirmed the mode for this historical format.';

create table public.race_relay_points (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  race_aid_station_id uuid references public.race_aid_stations(id) on delete set null,
  name text not null,
  km numeric not null,
  handover_time text,
  cutoff_time text,
  notes text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  constraint race_relay_points_name_check check (btrim(name) <> ''),
  constraint race_relay_points_km_check check (km > 0),
  constraint race_relay_points_order_index_check check (order_index >= 0)
);

create index race_relay_points_race_order_idx
  on public.race_relay_points(race_id, order_index);

create index race_relay_points_aid_station_idx
  on public.race_relay_points(race_aid_station_id)
  where race_aid_station_id is not null;

alter table public.race_relay_points enable row level security;

revoke all on table public.race_relay_points from public, anon, authenticated;
grant select on table public.race_relay_points to anon, authenticated;
grant select, insert, update, delete on table public.race_relay_points to service_role;

create policy "Visible race relay points are viewable"
on public.race_relay_points
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.races as race_row
    where race_row.id = race_relay_points.race_id
      and (
        (
          race_row.is_public = true
          and race_row.is_live = true
          and race_row.racebook_is_live = true
        )
        or race_row.created_by = (select auth.uid())
        or exists (
          select 1
          from public.race_event_organizers as organizer_row
          where organizer_row.event_id = race_row.event_id
            and organizer_row.user_id = (select auth.uid())
            and organizer_row.revoked_at is null
        )
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      )
  )
);

comment on table public.race_relay_points is
  'Ordered relay handover points for a race. They may reference an aid station without becoming nutrition-plan aid stations.';

comment on column public.race_relay_points.race_aid_station_id is
  'Optional source aid station used as the handover location. Name and km remain copied on the relay point so deleting the station does not erase relay information.';
