-- Instagram Reels publishing from the admin "Publications" page.
-- social_posts: one Reel per row, created as a draft from a finished video_render_jobs row and
--   published only after an admin clicks "Publier maintenant" or "Programmer". Publishing is a
--   resumable state machine (container -> polling -> media_publish) advanced by a pg_cron tick.
-- social_accounts: the connected Instagram professional account, with its long-lived token
--   encrypted at rest by the web server (AES-256-GCM); the database never sees the clear token.
-- Both tables are service-role only, like video_render_jobs: RLS on, no policy, no client grant.

begin;

create or replace function public.set_social_publishing_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.set_social_publishing_updated_at() from public, anon, authenticated;

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'instagram' check (platform in ('instagram')),
  ig_user_id text not null check (char_length(ig_user_id) between 1 and 64),
  username text check (username is null or char_length(username) <= 64),
  -- "v1:<iv>:<tag>:<ciphertext>" (base64url), encrypted with SOCIAL_TOKEN_ENCRYPTION_KEY.
  access_token_encrypted text not null check (access_token_encrypted like 'v1:%'),
  token_expires_at timestamptz not null,
  token_refreshed_at timestamptz not null,
  status text not null default 'connected' check (status in ('connected', 'needs_reconnect')),
  status_message text check (status_message is null or char_length(status_message) <= 500),
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint social_accounts_platform_user_key unique (platform, ig_user_id)
);

create index social_accounts_connected_by_idx on public.social_accounts (connected_by);

create trigger set_social_accounts_updated_at
before update on public.social_accounts
for each row execute function public.set_social_publishing_updated_at();

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  -- set null: a deleted race or render keeps the publication history; an unpublished post whose
  -- render was deleted fails with an explicit message instead of blocking the render deletion.
  race_id uuid references public.races(id) on delete set null,
  video_job_id uuid references public.video_render_jobs(id) on delete set null,
  platform text not null default 'instagram' check (platform in ('instagram')),
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  caption text not null default '' check (char_length(caption) <= 2200),
  hashtags text[] not null default '{}' check (cardinality(hashtags) <= 30),
  cover_text text check (cover_text is null or char_length(cover_text) <= 200),
  -- Cloud Storage object path of the MP4 (jobs/<id>/reel.mp4), never a signed URL: the signed GET
  -- URL Meta downloads is generated when the container is created.
  video_url text check (video_url is null or char_length(video_url) <= 300),
  scheduled_at timestamptz,
  published_at timestamptz,
  ig_container_id text check (ig_container_id is null or char_length(ig_container_id) <= 64),
  ig_container_created_at timestamptz,
  publish_requested_at timestamptz,
  ig_media_id text check (ig_media_id is null or char_length(ig_media_id) <= 64),
  ig_permalink text check (ig_permalink is null or char_length(ig_permalink) <= 500),
  error text check (error is null or char_length(error) <= 1000),
  dry_run boolean not null default true,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  -- Lease and throttle of the state machine: a step runs only when null or past.
  locked_until timestamptz,
  content jsonb check (content is null or jsonb_typeof(content) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint social_posts_scheduled_has_date check (status <> 'scheduled' or scheduled_at is not null),
  constraint social_posts_published_has_date check (status <> 'published' or published_at is not null)
);

create index social_posts_status_scheduled_idx on public.social_posts (status, scheduled_at);
create index social_posts_created_idx on public.social_posts (created_at desc);
create index social_posts_race_idx on public.social_posts (race_id);
create index social_posts_video_job_idx on public.social_posts (video_job_id);
create index social_posts_created_by_idx on public.social_posts (created_by);

create trigger set_social_posts_updated_at
before update on public.social_posts
for each row execute function public.set_social_publishing_updated_at();

alter table public.social_accounts enable row level security;
alter table public.social_posts enable row level security;

revoke all on table public.social_accounts from public, anon, authenticated;
revoke all on table public.social_posts from public, anon, authenticated;
grant select, insert, update, delete on table public.social_accounts to service_role;
grant select, insert, update, delete on table public.social_posts to service_role;

comment on table public.social_posts is
  'Instagram Reels drafted from finished video_render_jobs and published by admin action only. Service-role only.';
comment on table public.social_accounts is
  'Connected Instagram professional account; long-lived token encrypted by the web server. Service-role only.';

commit;
