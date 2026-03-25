create table if not exists public.preset_races (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  distance_km numeric not null,
  elevation_m numeric not null,
  gpx_url text,
  checkpoints jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.preset_races enable row level security;

create policy "Anyone can read preset races"
  on public.preset_races
  for select
  to anon, authenticated
  using (true);

insert into public.preset_races (name, distance_km, elevation_m, gpx_url, checkpoints) values
(
  'Marathon des Sables light',
  42,
  800,
  null,
  '[
    {"km": 14, "name": "Ravitaillement CP1", "type": "ravito"},
    {"km": 28, "name": "Ravitaillement CP2", "type": "ravito"},
    {"km": 38, "name": "Ravitaillement CP3", "type": "ravito"}
  ]'::jsonb
),
(
  'Trail du Beaujolais',
  55,
  1800,
  null,
  '[
    {"km": 12, "name": "Saint-Cyr-le-Chatoux", "type": "ravito"},
    {"km": 25, "name": "Avenas", "type": "ravito"},
    {"km": 38, "name": "Ouroux", "type": "ravito"},
    {"km": 48, "name": "Monsols", "type": "ravito"}
  ]'::jsonb
),
(
  'UTMB OCC',
  55,
  3500,
  null,
  '[
    {"km": 10, "name": "Champex-d''Allex", "type": "checkpoint"},
    {"km": 20, "name": "La Fouly", "type": "ravito"},
    {"km": 30, "name": "Praz-de-Fort", "type": "ravito"},
    {"km": 42, "name": "Champex-Lac", "type": "ravito"},
    {"km": 50, "name": "Trient", "type": "ravito"}
  ]'::jsonb
),
(
  'Grand Raid des Pyrénées',
  80,
  5000,
  null,
  '[
    {"km": 15, "name": "Arrens-Marsous", "type": "ravito"},
    {"km": 30, "name": "Gourette", "type": "ravito"},
    {"km": 45, "name": "Gabas", "type": "ravito"},
    {"km": 62, "name": "Artouste", "type": "ravito"},
    {"km": 73, "name": "Fabrèges", "type": "ravito"}
  ]'::jsonb
),
(
  'CCC',
  100,
  6100,
  null,
  '[
    {"km": 18, "name": "Dolonne", "type": "ravito"},
    {"km": 35, "name": "La Vachey", "type": "ravito"},
    {"km": 52, "name": "Arnuva", "type": "ravito"},
    {"km": 68, "name": "Grand Col Ferret", "type": "checkpoint"},
    {"km": 83, "name": "La Fouly", "type": "ravito"}
  ]'::jsonb
);
