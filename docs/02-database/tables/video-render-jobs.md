---
title: video_render_jobs Table
scope: database
last_verified: 2026-11-04
ai_priority: low
related_files:
  - supabase/migrations/20261104140000_add_video_render_jobs.sql
  - supabase/tests/video_render_jobs_checks.sql
  - apps/web/lib/video-render.ts
  - apps/web/app/api/admin/video-generator/render-jobs/route.ts
  - apps/web/app/api/admin/video-generator/render-jobs/[id]/start/route.ts
  - apps/web/app/api/video-render/jobs/[id]/route.ts
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
| `race_id` | `uuid` | not null, references `races(id)` on delete cascade | Rendered race. |
| `race_title` | `text` | 1-200 characters | Title shown in the list and used for the download file name. |
| `status` | `text` | `uploading`, `queued`, `running`, `done`, `failed`; default `uploading` | Lifecycle. |
| `progress` | `real` | 0-1, default 0 | Share of frames rendered. |
| `message` | `text` | at most 500 characters | Failure reason. |
| `width`, `height` | `integer` | 160-4096 | Video size; the renderer opens a window of this size. |
| `output_size_bytes` | `bigint` | null or ≥ 0 | Size of the uploaded MP4, checked against Storage. |
| `cloud_run_execution` | `text` | nullable | Cloud Run execution name, for the logs. |
| `created_by` | `uuid` | references `auth.users(id)` on delete set null | Admin who started it. |
| `created_at`, `updated_at`, `started_at`, `finished_at` | `timestamptz` | | Timing; `updated_at` is refreshed by every progress report, and an active job silent for 15 minutes (or older than `MAX_RENDER_HOURS` + 1 h) is marked failed. |

## Access

RLS is enabled with no policy and every privilege is revoked from `anon` and `authenticated`: only the service role (admin routes, and render-page routes after their per-job token check) reads and writes rows. Status updates are guarded by the expected current status, so a finished job is never reopened.

`started_at` and `finished_at` are returned by the admin job list to show each render's duration, and finished (`done`) jobs are counted per race for the video generator picker (`race-stats`).
