-- Saved reel narration per race, so the admin does not rewrite the script or regenerate the voice
-- each time: composition settings (they decide the story cut, hence the beat ids), the edited
-- narration by beat id and the voice choice. The voice clips (base64 MP3, about 2 MB per reel)
-- live in the private Storage bucket video-narrations as <race_id>.json, not in the table.
-- Admin API routes read and write both with the service role.

create table public.video_narrations (
  race_id uuid primary key references public.races(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  narration_overrides jsonb not null default '{}'::jsonb,
  voice jsonb not null default '{}'::jsonb,
  clip_count integer not null default 0 check (clip_count >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

create index video_narrations_updated_by_idx on public.video_narrations (updated_by);

alter table public.video_narrations enable row level security;

revoke all on table public.video_narrations from public, anon, authenticated;
grant select, insert, update, delete on table public.video_narrations to service_role;

-- Private bucket, no policy: only the service role (admin API routes) reads and writes it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('video-narrations', 'video-narrations', false, 20971520, array['application/json'])
on conflict (id) do nothing;
