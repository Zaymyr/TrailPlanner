-- Persist public crew-side race tracking state for shared plan recaps.
-- Snapshot stays immutable until the runner re-shares; crew_state stores mutable
-- fields entered through the secret public link.

alter table public.plan_share_links
  add column if not exists crew_state jsonb not null default '{}'::jsonb;

alter table public.plan_share_links
  drop constraint if exists plan_share_links_crew_state_size_check;

alter table public.plan_share_links
  add constraint plan_share_links_crew_state_size_check
  check (octet_length(crew_state::text) <= 20000);
