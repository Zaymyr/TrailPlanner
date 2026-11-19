---
title: social_posts Table
scope: database
last_verified: 2026-11-19
ai_priority: medium
related_files:
  - supabase/migrations/20261119130000_add_social_posts.sql
  - supabase/migrations/20261119130100_schedule_social_posts_cron.sql
  - supabase/migrations/20261119170000_add_render_job_auto_draft.sql
  - supabase/tests/social_posts_checks.sql
  - apps/web/lib/social-posts.ts
  - apps/web/lib/social-post-auto-draft.ts
  - apps/web/lib/instagram/publisher.ts
  - apps/web/app/api/admin/social-posts/route.ts
  - apps/web/app/api/admin/social-posts/[id]/route.ts
  - apps/web/app/api/cron/social-posts-publish/route.ts
related_tables:
  - social_posts
  - video_render_jobs
  - races
---

# `social_posts`

## Purpose

One Instagram Reel drafted from a finished background render and published from the admin « Publications » page. The publication itself is a resumable state machine; see [Instagram Reels Publishing](../../05-integrations/instagram-publishing.md).

## Key Concepts

- Lifecycle: `draft` → (`scheduled` →) `publishing` → `published` | `failed`. `failed` can go back to `publishing` (« Réessayer ») and `scheduled` back to `draft` (« Annuler la programmation »).
- Only an admin action moves a draft out of `draft`; the cron only promotes `scheduled` posts whose time has come.
- `dry_run` records the mode the post was published in; a simulated post keeps fake `dry-run-…` ids.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key | Post id. |
| `race_id` | `uuid` | references `races(id)` on delete set null | Race of the reel (copied from the render). |
| `video_job_id` | `uuid` | references `video_render_jobs(id)` on delete set null | Source render. |
| `platform` | `text` | `instagram` only, default `instagram` | Target network. |
| `status` | `text` | `draft`, `scheduled`, `publishing`, `published`, `failed`; default `draft` | Lifecycle. |
| `caption` | `text` | ≤ 2,200 characters, default `''` | Text without hashtags. |
| `hashtags` | `text[]` | ≤ 30 entries, default `{}` | Normalized hashtags without `#`, appended after a blank line. |
| `cover_text` | `text` | ≤ 200 characters | Text for a future generated cover (not sent yet). |
| `video_url` | `text` | ≤ 300 characters | Cloud Storage object path `jobs/<job id>/reel.mp4`, not a URL: the signed URL Meta downloads is generated when the container is created. |
| `scheduled_at` | `timestamptz` | required when `scheduled` | Planned time (UTC; entered and shown in Europe/Paris); set to now by « Publier maintenant » and « Réessayer » and used as the start of the 24-hour publishing deadline. |
| `published_at` | `timestamptz` | required when `published` | Publication time. |
| `ig_container_id`, `ig_container_created_at` | `text`, `timestamptz` | | Meta media container, stored as soon as it is created so a retry resumes it. |
| `publish_requested_at` | `timestamptz` | | Set just before `media_publish`. While set without `ig_media_id`, the container status is read before any other rule, and dropping the container needs the admin's confirmation. |
| `ig_media_id`, `ig_permalink` | `text` | | Published media id (never published twice once set) and its link. |
| `error` | `text` | ≤ 1,000 characters | Last failure or retry message (French, shown to the admin). |
| `dry_run` | `boolean` | not null, default `true` | Simulated publication. |
| `attempt_count` | `integer` | ≥ 0, default 0 | Transient failures in a row (8 → failed). |
| `locked_until` | `timestamptz` | | Lease and throttle of the state machine. |
| `content` | `jsonb` | object or null | Full reel content JSON (hook, script segments, cta, caption, hashtags, cover text) copied from `video_render_jobs.content` when the draft is created; null without content. Informational: the publisher only reads `caption`, `hashtags` and `video_url`. |
| `auto_generated` | `boolean` | not null, default `false` | The draft was created by the render completion (one-click reel), not by an admin; shown as « Généré automatiquement » in Publications. Informational for the publisher. |
| `created_by` | `uuid` | references `auth.users(id)` on delete set null | Admin who created the draft (for an automatic draft, the admin who launched the render). |
| `created_at`, `updated_at` | `timestamptz` | `updated_at` set by trigger `set_social_posts_updated_at` | Timing. |

## Foreign Keys

- `race_id` → `races(id)` **on delete set null** and `video_job_id` → `video_render_jobs(id)` **on delete set null**: deleting a race or a render keeps the publication history, and the admin render deletion route keeps working without knowing about posts. An unpublished post whose render disappeared fails with an explicit message.
- `created_by` → `auth.users(id)` on delete set null.

## Indexes

- `social_posts_status_scheduled_idx (status, scheduled_at)`: the cron's due-post and runnable-post scans.
- `social_posts_created_idx (created_at desc)`: the admin list.
- `social_posts_auto_generated_video_job_uidx (video_job_id) where auto_generated and video_job_id is not null` (unique, partial): at most one automatic draft per render, so a retried completion callback can never create a second one. It was added with `auto_generated` in `20261119170000_add_render_job_auto_draft.sql` (the idempotency is also checked in the application before inserting). Manual drafts are not constrained: an admin can still create several drafts for one render.
- One index per foreign key (`race_id`, `video_job_id`, `created_by`).

## RLS Policies

RLS is enabled with no policy; every privilege is revoked from `public`, `anon` and `authenticated` and granted to `service_role` only, exactly like `video_render_jobs`. All access goes through admin routes gated by `authorizeVideoAdmin` and the cron route gated by `CRON_SECRET`. `supabase/tests/social_posts_checks.sql` asserts the grants, the defaults, the check constraints and the cron jobs.

## Business Invariants

- A new row is a dry-run `draft`. An automatic draft (`auto_generated`) is a `draft` too: it is never scheduled or published without an admin action.
- Every status transition is a PATCH guarded by the expected current status (and `ig_media_id=is.null` where relevant), so two clicks or a click racing the cron cannot both win.
- A step runs only after claiming the lease (`status=eq.publishing` and `locked_until` null or past).
- `media_publish` is never called when `ig_media_id` is set, nor for a container that is not `FINISHED`.
- Published posts cannot be edited or deleted.
- The cron promotes a due post only when its `dry_run` equals the current mode; a mismatch fails the post with a reschedule message, so a post scheduled in simulation is never published for real.
- `ig_container_id` and `publish_requested_at` are never cleared automatically once a live publish was requested; only an admin-confirmed restart (`confirmRestart`) drops them.

## Common Queries

```sql
-- Due posts the next tick will promote.
select id, scheduled_at from public.social_posts
where status = 'scheduled' and scheduled_at <= now();

-- In-flight publications and their lease.
select id, ig_container_id, locked_until, attempt_count, error
from public.social_posts where status = 'publishing';
```

## Gotchas

- `video_url` is a path, not a URL; never store a signed URL (it expires in 2 hours).
- Scheduling is refused past `finished_at + 30 days − 24 h` of the render (bucket lifecycle).
- `dry_run` is set when the post is scheduled and never rewritten by the cron. « Publier maintenant » and « Réessayer » use the current mode; a retry after a mode change drops the stored container (with confirmation if a live publish was requested).

## Related Docs

- [video_render_jobs](video-render-jobs.md)
- [Instagram Reels Publishing](../../05-integrations/instagram-publishing.md)
- [RLS Policies](../rls-policies.md)
