-- Add needs_review flag to race_aid_stations.
-- When a GPX re-import would delete an aid station that is referenced by
-- plan_aid_stations, the station is kept and flagged for manual review instead
-- of being hard-deleted.

alter table public.race_aid_stations
  add column if not exists needs_review boolean not null default false;
