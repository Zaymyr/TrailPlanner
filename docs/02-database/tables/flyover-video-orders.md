---
title: flyover_video_orders Table
scope: database
last_verified: 2026-11-22
ai_priority: low
related_files:
  - supabase/migrations/20261122100000_add_flyover_video_orders.sql
  - supabase/tests/flyover_video_orders_checks.sql
  - apps/web/lib/flyover-orders.ts
  - apps/web/lib/flyover-generation.ts
related_tables:
  - flyover_video_orders
  - video_render_jobs
  - social_posts
---

# `flyover_video_orders`

## Purpose

One row per organizer flyover video order (`/survol`), from the Stripe checkout to the delivered reel. Independent of the race catalog. Rules: [Organizer Flyover Video Orders](../../03-business-rules/flyover-video-orders.md).

## Key Concepts

- Status flow: `pending_payment` → `paid` (webhook) → `scripted` (text written) → `rendering` → `ready`; side exits `expired` (unpaid), `failed` (3 failed attempts), `refunded`.
- The GPX lives in the private `race-gpx` bucket at `gpx_storage_path` (`flyover/<id>.gpx`).

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, `gen_random_uuid()` | Order id; also the token subject and the Stripe metadata `order_id`. |
| `offer` | `text` | `collab` or `download` | Offer bought. |
| `amount_cents`, `currency` | `integer`, `text` | > 0; `eur` | Price at order time (2999 / 5999). |
| `status` | `text` | see flow, default `pending_payment` | Lifecycle. |
| `race_name` | `text` | 2–120 characters | Name told in the reel. |
| `race_date` | `date` | nullable | Optional race date (edition year in the title). |
| `contact_email` | `text` | required | Organizer email (confirmation, ready email). |
| `instagram_handle` | `text` | `^[A-Za-z0-9._]{1,30}$`, nullable | Event account without `@`; required for `collab`. |
| `map_preset` | `text` | `signature`, `satellite`, `relief`, `cinema` | Basemap preset. |
| `terrain_exaggeration` | `real` | 1–3, default 1.8 | Relief exaggeration. |
| `publish_local` | `text` | `YYYY-MM-DDTHH:mm`, nullable | Collab slot, Paris wall time; required for `collab` (`flyover_video_orders_collab_fields`). |
| `aid_stations` | `jsonb` | array, ≤ 40 | `[{ id, name, km }]`, ids fixed at order time. |
| `gpx_storage_path` | `text` | required | GPX object path. |
| `distance_km`, `elevation_gain_m`, `elevation_loss_m` | `real` | distance > 0 | GPX stats at order time. |
| `stripe_checkout_session_id`, `stripe_checkout_url`, `stripe_payment_intent_id`, `paid_at` | | session id unique when set | Stripe references. |
| `work` | `jsonb` | object, nullable | Reel work (settings, place names, text) from the text step to the render step. |
| `attempts`, `error`, `locked_until` | | | Retry count, last error, 10-minute step lease. |
| `render_job_id` | `uuid` | FK `video_render_jobs` on delete set null | Render of the video. |
| `social_post_id` | `uuid` | FK `social_posts` on delete set null | Collab Instagram post. |
| `ready_at`, `paid_email_sent_at`, `ready_email_sent_at` | `timestamptz` | | Delivery and email tracking. |
| `created_at`, `updated_at` | `timestamptz` | trigger on update | Timing. |

## Foreign Keys

`render_job_id` → `video_render_jobs(id)`, `social_post_id` → `social_posts(id)`, both on delete set null. Reverse: `video_render_jobs.flyover_order_id` → this table, on delete set null.

## Indexes

Unique partial on `stripe_checkout_session_id`; `(status, paid_at)`; `stripe_payment_intent_id`; `render_job_id`; `social_post_id`.

## RLS Policies

RLS on, no policy; every privilege revoked from `anon` and `authenticated`. Only the service role (public order route, Stripe webhook, cron route, order page server component) reads and writes.

## Business Invariants

- A `collab` order always has `instagram_handle` and `publish_local`.
- Status updates are guarded by the expected current status (webhook replays and concurrent ticks change nothing).
- The same migration makes `video_render_jobs.race_id` nullable (with `video_render_jobs_race_or_flyover`: a race or an order) and adds `social_posts.collaborators`.

## Common Queries

```sql
select id, race_name, offer, status, attempts, error, paid_at, ready_at
from public.flyover_video_orders
where status in ('paid', 'scripted', 'rendering', 'failed')
order by paid_at;
```

## Gotchas

- There is no admin screen yet: follow orders with the query above; a `failed` order also emails the team.
- Deleting a render job keeps the order `ready` but its download then fails.

## Related Docs

- [Organizer Flyover Video Orders](../../03-business-rules/flyover-video-orders.md)
- [video_render_jobs](video-render-jobs.md)
- [social_posts](social-posts.md)
