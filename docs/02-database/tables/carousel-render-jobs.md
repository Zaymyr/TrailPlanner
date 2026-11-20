---
title: carousel_render_jobs Table
scope: database
last_verified: 2026-11-20
ai_priority: low
related_files:
  - supabase/migrations/20261120180000_add_instagram_carousels.sql
  - supabase/tests/carousel_checks.sql
  - apps/web/lib/carousels/carousel-render.ts
  - apps/web/app/api/carousel-render/jobs/[id]/route.ts
related_tables:
  - carousel_render_jobs
  - races
  - social_posts
---

# `carousel_render_jobs`

## Purpose

One render of an Instagram carousel: the snapshot the render page draws, and the JPEG slides it uploads to Cloud Storage (`carousels/<id>/slide-<n>.jpg`). See [Automatic Instagram Carousels](../../05-integrations/instagram-carousels.md).

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key | Job id, Storage folder and token subject (scope `carousel-render`). |
| `series` | `text` | `plan`, `brief`, `week` | Carousel series. |
| `race_id` | `uuid` | references `races(id)` on delete set null | Race of a plan or brief; null for a week. |
| `title` | `text` | 1-200 characters | Shown in Publications. |
| `status` | `text` | `queued`, `running`, `done`, `failed`; default `queued` | Lifecycle. |
| `snapshot` | `jsonb` | object, not null | Everything the slides draw, computed on the server. |
| `content` | `jsonb` | object or null | Caption, hashtags and writer warnings, copied into the draft. |
| `slide_count` | `integer` | 2-10 | Number of slides. |
| `image_paths` | `text[]` | ≤ 10, default `{}`; equals `slide_count` entries when `done` | Object paths in slide order. |
| `message` | `text` | ≤ 500 | Failure reason. |
| `cloud_run_execution` | `text` | ≤ 300 | Execution name, for the logs. |
| `auto_draft` | `boolean` | default `false` | Create the `social_posts` draft when done. |
| `created_by` | `uuid` | references `auth.users(id)` on delete set null | Admin who generated it (automatic: `reel_automation_settings.updated_by`). |
| `created_at`, `updated_at`, `started_at`, `finished_at` | `timestamptz` | | Timing; `updated_at` by trigger. `finished_at` + 30 days is the image lifetime (bucket lifecycle). |

Indexes: `created_at desc`, `race_id`, `created_by`. Check `carousel_render_jobs_done_has_images`.

## Access

RLS on, no policy, privileges revoked from `public`, `anon`, `authenticated`, granted to `service_role`, like `video_render_jobs`. Written by the admin and cron routes (service role) and by the render page routes after the carousel-scoped token check. Status updates are guarded by the expected status.

## Why a separate table

`video_render_jobs` requires a race, a video size and an MP4, and every row counts as a reel of its race (reel duplicate guard, video counts). Carousels have no race for « La semaine qui vient » and several outputs.
