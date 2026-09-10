alter table public.race_event_organizers
  add column if not exists dashboard_onboarding_completed_at timestamptz;

comment on column public.race_event_organizers.dashboard_onboarding_completed_at is
  'When this organizer completed or skipped the dashboard guide for this event membership.';
