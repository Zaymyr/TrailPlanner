-- Automated Instagram carousels (admin): three weekly series (« Le plan chiffré », « Le brief »,
-- « La semaine qui vient ») rendered to JPEG slides on the existing Cloud Run renderer, drafted and
-- published through social_posts, and planned next to the automatic reels.
--
-- Additive only:
--   * carousel_render_jobs: one slide render (snapshot in the row, JPEGs in Cloud Storage).
--   * carousel_automation_items: one planned weekly slot per series.
--   * social_posts: media_type ('reel' default), carousel fields, child container ids.
--   * reel_automation_settings: one switch per series (off by default).
-- Admin-only like video_render_jobs: RLS on, no client policy, service role only.

begin;

create table public.carousel_render_jobs (
  id uuid primary key default gen_random_uuid(),
  series text not null check (series in ('plan', 'brief', 'week')),
  -- null for « La semaine qui vient » (several races); set null keeps the history of a deleted race.
  race_id uuid references public.races(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  -- Everything the render page draws (texts, figures, profile): a few kilobytes, kept in the row.
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  -- Caption, hashtags and writer warnings copied into the automatic draft.
  content jsonb check (content is null or jsonb_typeof(content) = 'object'),
  slide_count integer not null check (slide_count between 2 and 10),
  -- Cloud Storage object paths of the JPEG slides, in order, set when the render is done.
  image_paths text[] not null default '{}' check (cardinality(image_paths) <= 10),
  message text check (message is null or char_length(message) <= 500),
  cloud_run_execution text check (cloud_run_execution is null or char_length(cloud_run_execution) <= 300),
  auto_draft boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  finished_at timestamptz,
  constraint carousel_render_jobs_done_has_images check (status <> 'done' or cardinality(image_paths) = slide_count)
);

create index carousel_render_jobs_created_idx on public.carousel_render_jobs (created_at desc);
create index carousel_render_jobs_race_idx on public.carousel_render_jobs (race_id);
create index carousel_render_jobs_created_by_idx on public.carousel_render_jobs (created_by);

create trigger set_carousel_render_jobs_updated_at
before update on public.carousel_render_jobs
for each row execute function public.set_social_publishing_updated_at();

alter table public.social_posts
  add column media_type text not null default 'reel' check (media_type in ('reel', 'carousel')),
  add column carousel_series text check (carousel_series is null or carousel_series in ('plan', 'brief', 'week')),
  add column carousel_job_id uuid references public.carousel_render_jobs(id) on delete set null,
  -- Ordered object paths of the slides (never signed URLs: they are signed when the containers are created).
  add column image_paths text[] check (image_paths is null or cardinality(image_paths) between 2 and 10),
  -- Carousel item containers created so far, in slide order: a retry resumes them.
  add column ig_child_container_ids text[] not null default '{}' check (cardinality(ig_child_container_ids) <= 10),
  add constraint social_posts_carousel_shape check (
    media_type = 'reel'
    or (carousel_series is not null and image_paths is not null and video_job_id is null and video_url is null)
  ),
  add constraint social_posts_reel_shape check (
    media_type = 'carousel'
    or (carousel_series is null and carousel_job_id is null and image_paths is null and cardinality(ig_child_container_ids) = 0)
  );

create index social_posts_carousel_job_idx on public.social_posts (carousel_job_id);
-- At most one automatic draft per carousel render, like social_posts_auto_generated_video_job_uidx.
create unique index social_posts_auto_generated_carousel_job_uidx
  on public.social_posts (carousel_job_id)
  where auto_generated and carousel_job_id is not null;

alter table public.reel_automation_settings
  add column plan_carousel_enabled boolean not null default false,
  add column brief_carousel_enabled boolean not null default false,
  add column week_carousel_enabled boolean not null default false;

create table public.carousel_automation_items (
  id uuid primary key default gen_random_uuid(),
  series text not null check (series in ('plan', 'brief', 'week')),
  -- Tuesday (plan), Thursday (brief) or Sunday (week), Paris calendar day.
  planned_publish_date date not null,
  race_id uuid references public.races(id) on delete set null,
  edition_key text check (edition_key is null or char_length(edition_key) between 1 and 200),
  -- Monday of the week covered by « La semaine qui vient ».
  week_start date,
  status text not null default 'planned'
    check (status in ('planned', 'generating', 'rendering', 'drafted', 'scheduled', 'skipped', 'failed')),
  step text check (step is null or step in ('content', 'render')),
  attempts integer not null default 0 check (attempts >= 0),
  error text check (error is null or char_length(error) <= 1000),
  reason text check (reason is null or reason in ('too_late', 'no_candidate', 'occupied', 'duplicate', 'excluded', 'ineligible')),
  work jsonb check (work is null or jsonb_typeof(work) = 'object'),
  carousel_job_id uuid references public.carousel_render_jobs(id) on delete set null,
  social_post_id uuid references public.social_posts(id) on delete set null,
  locked_until timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  -- One slot per series and day.
  constraint carousel_automation_items_series_day unique (series, planned_publish_date)
);

create index carousel_automation_items_status_date_idx on public.carousel_automation_items (status, planned_publish_date);
create index carousel_automation_items_race_idx on public.carousel_automation_items (race_id);
create index carousel_automation_items_job_idx on public.carousel_automation_items (carousel_job_id);
create index carousel_automation_items_social_post_idx on public.carousel_automation_items (social_post_id);

create trigger set_carousel_automation_items_updated_at
before update on public.carousel_automation_items
for each row execute function public.set_reel_automation_updated_at();

alter table public.carousel_render_jobs enable row level security;
alter table public.carousel_automation_items enable row level security;

revoke all on table public.carousel_render_jobs from public, anon, authenticated;
revoke all on table public.carousel_automation_items from public, anon, authenticated;
grant select, insert, update, delete on table public.carousel_render_jobs to service_role;
grant select, insert, update, delete on table public.carousel_automation_items to service_role;

comment on table public.carousel_render_jobs is
  'Instagram carousel slide renders (Cloud Run headless Chrome, JPEGs in Cloud Storage). Service-role only.';
comment on table public.carousel_automation_items is
  'Weekly automatic Instagram carousel slots (plan chiffré, brief, semaine qui vient). Service-role only.';

commit;
