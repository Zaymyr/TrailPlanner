---
title: video_render_jobs Table
scope: database
last_verified: 2026-11-22
ai_priority: low
related_files:
  - supabase/migrations/20261104140000_add_video_render_jobs.sql
  - supabase/migrations/20261119160000_add_reel_content.sql
  - supabase/migrations/20261119170000_add_render_job_auto_draft.sql
  - supabase/tests/video_render_jobs_checks.sql
  - apps/web/lib/video-render.ts
  - apps/web/app/api/admin/video-generator/render-jobs/route.ts
  - apps/web/app/api/admin/video-generator/render-jobs/[id]/start/route.ts
  - apps/web/app/api/video-render/jobs/[id]/route.ts
  - apps/web/lib/social-post-auto-draft.ts
  - apps/web/lib/reel-generation.ts
  - supabase/migrations/20261122100000_add_flyover_video_orders.sql
related_tables:
  - video_render_jobs
  - races
---

# `video_render_jobs`

## Purpose

Tracks background renders of the admin 3D reel. The render runs in a Google Cloud Run job; the composition snapshot and the MP4 live in Google Cloud Storage (`jobs/<id>/input.json`, `jobs/<id>/reel.mp4`), not in this table. See [Google Cloud Background Reel Render](../../05-integrations/google-cloud-video-render.md).

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, `gen_random_uuid()` | Job id, also the Storage folder and the token subject. |
| `race_id` | `uuid` | nullable since 2026-11-22, references `races(id)` on delete cascade | Rendered race. Null only for an organizer flyover render (see `flyover_order_id`). |
| `flyover_order_id` | `uuid` | nullable, references `flyover_video_orders(id)` on delete set null | Organizer flyover order this render belongs to; `race_id` is null then. Check `video_render_jobs_race_or_flyover`: a job has a race or an order. |
| `race_title` | `text` | 1-200 characters | Title shown in the list and used for the download file name. |
| `status` | `text` | `uploading`, `queued`, `running`, `done`, `failed`; default `uploading` | Lifecycle. |
| `progress` | `real` | 0-1, default 0 | Share of frames rendered. |
| `message` | `text` | at most 500 characters | Failure reason. |
| `width`, `height` | `integer` | 160-4096 | Video size; the renderer opens a window of this size. |
| `output_size_bytes` | `bigint` | null or ≥ 0 | Size of the uploaded MP4, checked against Storage. |
| `cloud_run_execution` | `text` | nullable | Cloud Run execution name, for the logs. |
| `content` | `jsonb` | nullable, JSON object when set (`video_render_jobs_content_object`) | Snapshot of the highlights reel text (see `video_narrations.content`) taken when the job is created, so Publications can pre-fill the Instagram draft of this very video; validated by the render-jobs POST with the same Zod schema. Null for full reels launched from the editor and for older jobs; an automatic full reel carries a content assembled from its script and caption (`assembleFullReelContent`). |
| `auto_draft` | `boolean` | not null, default `false` | One-click reel: create the job's Instagram draft when the render finishes. Set by the render-jobs POST (`autoDraft: true`, only accepted together with `content`); read by the render completion route, which then creates one `social_posts` draft (service role). Older rows are `false`. |
| `created_by` | `uuid` | references `auth.users(id)` on delete set null | Admin who started it. |
| `created_at`, `updated_at`, `started_at`, `finished_at` | `timestamptz` | | Timing; `updated_at` is refreshed by every progress report, and an active job silent for 15 minutes (or older than `MAX_RENDER_HOURS` + 1 h) is marked failed; the GPU task itself stops at 1 h. |

## Automatic draft

Migration `20261119170000_add_render_job_auto_draft.sql` adds `auto_draft` (additive, not null with a default: existing rows and older clients are unaffected; RLS and grants unchanged). When `POST /api/video-render/jobs/<id>` marks a job `done` and the row has `auto_draft = true` and a non-null `content`, it creates one draft in [`social_posts`](social-posts.md) owned by the job's `created_by`; a failure to do so is logged and never fails the completion. See [Google Cloud Background Reel Render](../../05-integrations/google-cloud-video-render.md).

## Flyover renders

Migration `20261122100000_add_flyover_video_orders.sql` drops `NOT NULL` on `race_id`, adds `flyover_order_id` and the check `video_render_jobs_race_or_flyover`. `videoRenderJobRowSchema.race_id` is nullable, `flyover_order_id` is in `VIDEO_RENDER_JOB_COLUMNS`, and `launchReelRender` (`apps/web/lib/reel-generation.ts`, shared with the automatic reels) creates these jobs with `auto_draft = false`. They are excluded from the Publications "videos to publish" list. See [Organizer Flyover Video Orders](../../03-business-rules/flyover-video-orders.md).

## Access

RLS is enabled with no policy and every privilege is revoked from `anon` and `authenticated`: only the service role (admin routes, and render-page routes after their per-job token check) reads and writes rows. Status updates are guarded by the expected current status, so a finished job is never reopened.

The automatic reel pipeline ([Automatic Reel Pipeline](../../05-integrations/reel-automation.md)) also creates jobs, from the cron route with the service role (`runRenderStep`, `apps/web/lib/reel-generation.ts`): `created_by` = the admin who last changed the automation switches, `content` set, `auto_draft = true`; a failed launch marks its job `failed` so it never counts as a reel of the race. `reel_automation_items.render_job_id` references the job (on delete set null). A non-failed job of a race also stops the pipeline from processing that race (duplicate guard).

Carousel renders use their own table, [`carousel_render_jobs`](carousel-render-jobs.md), with the same Cloud Run job and bucket; `lib/video-render.ts` only gained a token scope (`video-render` by default, `carousel-render` for carousels) and the page kind of `buildRenderUrl` (`video` by default). Nothing changes for this table.

`started_at` and `finished_at` are returned by the admin job list to show each render's duration, and finished (`done`) jobs are counted per race for the video generator picker (`race-stats`).

The admin can delete a finished or failed job (`DELETE /api/admin/video-generator/render-jobs/<id>`, service role, guarded by `status=in.(done,failed)`); its Cloud Storage objects are deleted best-effort and otherwise expire with the 30-day lifecycle.

`social_posts.video_job_id` references this table **on delete set null** (2026-11-19): deleting a render never fails because of a post, and an unpublished post whose render is gone fails with an explicit message. See [social_posts](social-posts.md).
