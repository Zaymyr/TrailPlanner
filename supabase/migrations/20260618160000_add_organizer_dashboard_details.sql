alter table public.race_events
  add column if not exists organizer_details jsonb;

comment on column public.race_events.organizer_details is
  'Organizer-managed progressive dashboard details such as mandatory equipment, bib pickup, access, services, partners, and runner-facing notes.';

alter table public.races
  add column if not exists organizer_details jsonb;

comment on column public.races.organizer_details is
  'Organizer-managed progressive format details such as start time, finish cutoff, shuttle schedule, cutoff notes, and format notes.';

alter table public.race_aid_stations
  add column if not exists organizer_details jsonb;

comment on column public.race_aid_stations.organizer_details is
  'Organizer-managed progressive aid-station details such as station type, cumulative elevation, altitude, cutoff time, drop bag availability, and organizer notes.';
