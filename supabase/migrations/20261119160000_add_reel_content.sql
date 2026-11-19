-- Text content of a highlights reel (hook, script segments, call to action, Instagram caption,
-- hashtags, cover text), written in one Claude call and validated by the web app (Zod,
-- apps/web/lib/reel-content.ts). Stored with the narration (reloaded with the race and mode) and
-- snapshotted on the render job at creation (the video it belongs to). Null for full reels and
-- for rows created before this migration. RLS and grants are unchanged (service role only).

alter table public.video_narrations
  add column content jsonb;

alter table public.video_render_jobs
  add column content jsonb;

alter table public.video_narrations
  add constraint video_narrations_content_object check (content is null or jsonb_typeof(content) = 'object');

alter table public.video_render_jobs
  add constraint video_render_jobs_content_object check (content is null or jsonb_typeof(content) = 'object');
