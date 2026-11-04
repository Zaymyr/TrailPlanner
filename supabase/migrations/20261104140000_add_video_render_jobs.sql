-- Background renders of the admin 3D reel. The render itself runs in a Google Cloud Run job and
-- the input snapshot and the MP4 live in Google Cloud Storage; this table only tracks each job.
-- Admin API routes and the render page (per-job signed token) use the service role.

create table public.video_render_jobs (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  race_title text not null check (char_length(race_title) between 1 and 200),
  status text not null default 'uploading'
    check (status in ('uploading', 'queued', 'running', 'done', 'failed')),
  progress real not null default 0 check (progress >= 0 and progress <= 1),
  message text check (message is null or char_length(message) <= 500),
  width integer not null check (width between 160 and 4096),
  height integer not null check (height between 160 and 4096),
  output_size_bytes bigint check (output_size_bytes is null or output_size_bytes >= 0),
  cloud_run_execution text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  finished_at timestamptz
);

create index video_render_jobs_created_idx on public.video_render_jobs (created_at desc);
create index video_render_jobs_race_idx on public.video_render_jobs (race_id);
create index video_render_jobs_created_by_idx on public.video_render_jobs (created_by);

alter table public.video_render_jobs enable row level security;

revoke all on table public.video_render_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.video_render_jobs to service_role;
