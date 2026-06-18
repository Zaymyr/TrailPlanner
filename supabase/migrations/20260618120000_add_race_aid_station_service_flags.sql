alter table public.race_aid_stations
  add column if not exists solid_available boolean not null default true,
  add column if not exists assistance_allowed boolean not null default true;

comment on column public.race_aid_stations.solid_available is
  'Whether official solid food is available at this source aid station.';

comment on column public.race_aid_stations.assistance_allowed is
  'Whether personal crew assistance is allowed at this source aid station.';
