---
title: carousel_automation_items Table
scope: database
last_verified: 2026-11-20
ai_priority: low
related_files:
  - supabase/migrations/20261120180000_add_instagram_carousels.sql
  - supabase/tests/carousel_checks.sql
  - apps/web/lib/carousels/carousel-automation.ts
  - apps/web/app/api/admin/carousel-automation/items/[id]/route.ts
related_tables:
  - carousel_automation_items
  - carousel_render_jobs
  - social_posts
  - races
---

# `carousel_automation_items`

## Purpose

One weekly slot of an automatic carousel series: its day, its race (or week), and its progress through the executor. See [Automatic Instagram Carousels](../../05-integrations/instagram-carousels.md).

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key | Slot id (« Exclure » / « Rétablir »). |
| `series` | `text` | `plan`, `brief`, `week` | Series. |
| `planned_publish_date` | `date` | not null | Paris day: Tuesday, Thursday or Sunday. |
| `race_id` | `uuid` | references `races(id)` on delete set null | Chosen race (plan, brief). |
| `edition_key` | `text` | 1-200 or null | Edition of the race (same key as the reels), one slot per series and edition. |
| `week_start` | `date` | nullable | Monday covered by a `week` slot. |
| `status` | `text` | `planned`, `generating`, `rendering`, `drafted`, `scheduled`, `skipped`, `failed` | Lifecycle. |
| `step` | `text` | null, `content`, `render` | Next step while generating. |
| `attempts` | `integer` | ≥ 0 | Failed attempts of the step (fails at 3). |
| `error` | `text` | ≤ 1,000 | Last error or reason detail. |
| `reason` | `text` | `too_late`, `no_candidate`, `occupied`, `duplicate`, `excluded`, `ineligible` | Why a slot is skipped. |
| `work` | `jsonb` | object or null | Snapshot, title and caption handed to the render step. |
| `carousel_job_id` | `uuid` | references `carousel_render_jobs(id)` on delete set null | Render launched. |
| `social_post_id` | `uuid` | references `social_posts(id)` on delete set null | Automatic draft. |
| `locked_until` | `timestamptz` | | 10-minute lease of a step. |
| `created_at`, `updated_at` | `timestamptz` | | `updated_at` by trigger. |

Constraint `carousel_automation_items_series_day unique (series, planned_publish_date)`. Indexes on `(status, planned_publish_date)`, `race_id`, `carousel_job_id`, `social_post_id`.

## Business rules

- `planned` and automatic skips (`too_late`, `no_candidate`, `occupied`) dated today or later are recomputed every tick; a past `planned` slot becomes `too_late`; other rows are kept.
- The edition uniqueness per series is enforced by the planner and checked again before the content step (no database index, so a recomputation can swap races between two planned slots).
- Status changes are guarded by the expected status.

## Access

RLS on, no policy, privileges revoked from client roles, granted to `service_role`. Written by the cron route (`CRON_SECRET`) and the admin routes (`authorizeVideoAdmin`).

## Admin audit journal (lot 7)

`app/api/admin/carousel-automation/items/[id]/route.ts` now exports its write handler through `withAdminAudit` (`apps/web/lib/admin-audit-log.ts`): each successful or server-failed call writes one best-effort line (`automation.carousel-item`) to the admin action journal ([`admin_audit_log`](./admin-audit-log.md), shown in `/admin/system/audit`). The request and response contracts, the business rules and the schema described here are unchanged.
