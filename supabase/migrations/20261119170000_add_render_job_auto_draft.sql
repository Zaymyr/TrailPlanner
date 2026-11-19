-- One-click reel: a render launched with "auto draft" creates its Instagram draft by itself when
-- the render finishes (apps/web/app/api/video-render/jobs/[id]/route.ts, service role).
--   video_render_jobs.auto_draft   the admin asked for the draft at launch time.
--   social_posts.auto_generated    the draft was created by the render completion, not by an admin
--                                  (shown as "Généré automatiquement" in Publications).
-- The partial unique index makes the creation idempotent in the database: a retried completion
-- callback can never produce a second automatic draft for the same render. Manual drafts are not
-- constrained. RLS and grants are unchanged (service role only).

alter table public.video_render_jobs
  add column auto_draft boolean not null default false;

alter table public.social_posts
  add column auto_generated boolean not null default false;

create unique index social_posts_auto_generated_video_job_uidx
  on public.social_posts (video_job_id)
  where auto_generated and video_job_id is not null;
