---
title: reel_automation_items Table
scope: database
last_verified: 2026-11-21
ai_priority: low
related_files:
  - supabase/migrations/20261120140000_add_reel_automation.sql
  - supabase/tests/reel_automation_checks.sql
  - apps/web/lib/reel-automation.ts
  - apps/web/app/api/admin/reel-automation/items/[id]/route.ts
related_tables:
  - reel_automation_items
  - races
  - video_render_jobs
  - social_posts
---

# `reel_automation_items`

## Purpose

One automatic reel: a race of one event edition, its story mode, its planned publication day and its progress through the executor. See [Automatic Reel Pipeline](../../05-integrations/reel-automation.md).

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, `gen_random_uuid()` | Item id (admin « Exclure » / « Rétablir »). |
| `race_id` | `uuid` | not null, references `races(id)` on delete cascade | The format. |
| `edition_key` | `text` | not null, 1-200 characters | `edition:<edition_id>`, else `event:<event_id>:<year>`, else `race:<race_id>:<date>`. |
| `mode` | `text` | `full` or `highlights` | Story mode (over 60 km: highlights). |
| `planned_publish_date` | `date` | not null | Planned Paris publication day; for an automatic skip, the day it would have needed. |
| `status` | `text` | `planned`, `generating`, `rendering`, `drafted`, `scheduled`, `skipped`, `failed`; default `planned` | Lifecycle. |
| `step` | `text` | null or `content`, `voice`, `render` | Next step while generating. |
| `attempts` | `integer` | ≥ 0, default 0 | Failed attempts of the current step (fails at 3). |
| `error` | `text` | at most 1,000 characters | Last error, or why scheduling was refused. |
| `reason` | `text` | null or `too_late`, `duplicate`, `excluded`, `ineligible` | Why a skipped item is skipped. |
| `work` | `jsonb` | null or object | Step data: settings, landmarks, place names, texts, content, warnings, voice. No audio (the clips live in the narration storage). |
| `render_job_id` | `uuid` | references `video_render_jobs(id)` on delete set null, indexed | Render launched by the item. |
| `social_post_id` | `uuid` | references `social_posts(id)` on delete set null, indexed | Automatic draft of that render. |
| `locked_until` | `timestamptz` | nullable | Lease of the step in progress (10 minutes). |
| `created_at`, `updated_at` | `timestamptz` | not null, now (UTC) | `updated_at` refreshed by `set_reel_automation_items_updated_at`. |

Constraint `reel_automation_items_race_edition_key unique (race_id, edition_key)`: never two items for the same race and edition. Index `(status, planned_publish_date)`.

## Access

RLS on, no policy, every privilege revoked from `public`, `anon` and `authenticated`, granted to `service_role`, like `video_render_jobs`. Written by the cron route (`CRON_SECRET`) and the admin routes (`authorizeVideoAdmin`).

## Business rules

- `planned` rows and `skipped` rows with reason `too_late` or `duplicate` are recomputed by every plan refresh (updated or deleted); all other rows are kept as they are.
- The plan never puts an item on the weekday of an enabled carousel series nor on the day of a carousel slot still waiting (one post a day across reels and carousels).
- Status changes are guarded by the expected status in the update filter; a step runs only under a free lease.
- `supabase/tests/reel_automation_checks.sql` checks RLS, grants, the unique key and the status, mode and `work` checks.
