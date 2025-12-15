-- Create a table to store user feedback submitted from the race planner
create table if not exists public.app_feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  subject text not null,
  detail text not null
);

alter table public.app_feedback enable row level security;
