alter table public.races
  add column if not exists edition_group_id uuid;

alter table public.races
  add column if not exists series_name text;

update public.races
set edition_group_id = id
where edition_group_id is null;

update public.races
set series_name = name
where series_name is null or btrim(series_name) = '';

alter table public.races
  alter column edition_group_id set not null;

alter table public.races
  alter column series_name set not null;

create index if not exists races_event_edition_group_idx
  on public.races(event_id, edition_group_id, race_date desc);

comment on column public.races.edition_group_id is
  'Stable organizer format/series identifier shared by annual editions of the same race under one event.';

comment on column public.races.series_name is
  'Stable organizer format label shared by annual editions of the same race under one event.';
