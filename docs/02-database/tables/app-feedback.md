---
title: app_feedback Table
scope: database
last_verified: 2026-11-23
ai_priority: medium
related_files:
  - supabase/migrations/20261105180000_add_app_feedback_review.sql
  - supabase/tests/app_feedback_review_checks.sql
  - apps/web/app/api/feedback/route.ts
  - apps/web/app/api/admin/feedback/route.ts
  - apps/web/app/api/admin/inbox-counts/route.ts
  - apps/mobile/components/feedback/FeedbackHeaderButton.tsx
related_tables:
  - app_feedback
  - user_notifications
---

# app_feedback Table

## Purpose

Bug reports (`kind = 'bug'`) and feedback (`kind = 'feedback'`) sent from the app or the web. The admin "Messagerie" tab reviews them and replies in the author's notification inbox.

## Columns

| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigint identity | Primary key. |
| `created_at` | timestamptz | Submission time. |
| `user_id` | uuid nullable | Author; null for anonymous web submissions (no reply possible). Set null when the Auth user is deleted. |
| `kind` | text | `bug` or `feedback`. |
| `source` | text | `mobile`, `web` or `unknown`. |
| `screen`, `app_version` | text nullable | Context sent by the client. |
| `subject`, `detail` | text | Clients prefix bug subjects with `[bug] ` and append `---` technical lines to `detail`; the admin list strips and folds them. |
| `status` | text | `pending` (default), `completed` or `rejected`. |
| `is_pending` | boolean generated | `status = 'pending'`; the admin list orders by it so handled items sink below. |
| `updated_at` | timestamptz | Trigger-maintained. |
| `reviewed_at`, `reviewed_by` | timestamptz, uuid nullable | Last admin review; `reviewed_by` set null when that admin is deleted. |

## Access

- RLS on. `authenticated` may only INSERT the submission columns (`user_id, kind, source, screen, app_version, subject, detail`) under the existing `auth.uid() = user_id` policy: no read-back, no update, and the review columns stay server-managed. `anon` has no privilege (the web route inserts with the service role).
- `review_app_feedback_with_notification` (`SECURITY INVOKER`, `service_role` only) sets the status and inserts the reply into `user_notifications` (`kind = 'admin_message'`, `feedback_id`) in one transaction, idempotent on the notification UUID like the race-request RPC.
- A status change without a reply (author without an account, or a silent triage) is a plain service-role PATCH from `/api/admin/feedback`.

## Mobile presentation

Forms and headers use the themed trail components: inputs are road-notebook `Field`s (units shown as cotes, searches with `variant="search"`), header and modal icon buttons are `IconAction` watch buttons (`tone="onBrand"` on forest headers) and back buttons are `IconAction variant="back"` sign blades. Parsing, validation and the data written are unchanged.

Submit and cancel actions use `ActionButton` (primary with a loading state, ghost cancel); payloads and writes are unchanged.

Admin inbox (2026-11-16): the « Demandes de course » tab now also lists organizer demo requests (`organizer_demo_requests`) above runner race requests, and its badge adds their pending count; bug and feedback review is unchanged.

`pending` rows are counted by `GET /api/admin/inbox-counts` (service role) for the Bugs and Feedback badges of the admin Messagerie.

Admin console (2026-11-22, lot 2): pending bugs and feedback are also listed in the single « À traiter » queue (`GET /api/admin/inbox`, `id, created_at, kind, subject, source, screen`, service role, oldest first, late after 24 h for a bug and 72 h for feedback); each row opens `/admin/inbox?vue=bugs|feedback`, where they are answered as before. `inbox-counts` keeps the same pending counts and adds the system items of the queue (`failedFlyovers`, `failedPosts`, `draftPosts`, `failedRenders`, since lot 3 `systemIncidents` for the systems that are down, `systemTotal`). No change to the table.

## Admin audit journal (lot 7)

`app/api/admin/feedback/route.ts` now exports its write handler through `withAdminAudit` (`apps/web/lib/admin-audit-log.ts`): each successful or server-failed call writes one best-effort line (`feedback.status`) to the admin action journal ([`admin_audit_log`](./admin-audit-log.md), shown in `/admin/system/audit`). The request and response contracts, the business rules and the schema described here are unchanged.
