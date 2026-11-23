---
title: user_notifications Table
scope: database
last_verified: 2026-11-23
ai_priority: high
related_files:
  - apps/web/lib/admin-messages.ts
  - apps/web/lib/admin-messages-server.ts
  - apps/web/app/api/admin/user-notifications/route.ts
  - supabase/migrations/20261116180000_add_feedback_surveys.sql
  - supabase/tests/feedback_survey_checks.sql
  - supabase/migrations/20261105180000_add_app_feedback_review.sql
  - supabase/tests/app_feedback_review_checks.sql
  - supabase/migrations/20261105115106_admin_user_notifications.sql
  - supabase/tests/admin_user_notifications_checks.sql
related_tables:
  - user_notifications
  - race_requests
  - push_notification_events
  - feedback_survey_campaigns
  - feedback_survey_responses
---

# user_notifications Table

## Purpose

Stores the durable in-app inbox for messages sent by trusted administrators to one runner, including feedback survey messages sent to a targeted audience. The row is the source of truth even when optional Resend email or Expo push delivery is unavailable or fails.

## Key Concepts

- Notification kinds are `admin_message`, `race_request_status` and `feedback_survey` (a survey message; the app shows the 3-question form under its body).
- The application channel is mandatory; `email_requested` and `push_requested` are optional.
- Delivery statuses are `not_requested`, `pending`, `sent`, `failed`, or `unavailable`.
- Reading a notification changes only `read_at`; deleting it from the inbox sets `deleted_at` (and `read_at` when still unread). Owners never hard-delete.

## Columns

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key and cross-channel idempotency key. |
| `user_id` | uuid | Recipient Auth user; cascades on deletion. |
| `created_by` | uuid nullable | Admin audit actor; set null if deleted. |
| `race_request_id` | bigint nullable | Optional related request; set null if deleted. |
| `kind` | text | `admin_message`, `race_request_status` or `feedback_survey`. |
| `survey_campaign_id` | uuid nullable | [feedback_survey_campaigns](feedback-survey-campaigns.md) row of a survey message; set null if deleted. Non-null only for `feedback_survey`. Not client-readable. |
| `title` | text | Trimmed, 1–160 characters. |
| `body` | text | Trimmed, 1–4000 characters. |
| `read_at` | timestamptz nullable | Owner read receipt. |
| `feedback_id` | bigint nullable | Bug or feedback this message answers (`app_feedback`); set null if deleted. Owner-readable. |
| `deleted_at` | timestamptz nullable | Set by the owner to remove the message from their inbox; the row stays so the admin still sees the reply. Owner-updatable. |
| `email_requested` / `push_requested` | boolean | Admin-selected external channels. |
| `email_status` / `push_status` | text | Durable delivery state. |
| `email_provider_id` | text nullable | Resend message id. |
| `email_error` / `push_error` | text nullable | Server-only failure detail. |
| `push_sent_count` | integer | Non-negative number of device deliveries recorded by the server. |
| `created_at` / `updated_at` | timestamptz | Creation and trigger-maintained update times. |

## Foreign Keys

- `user_id -> auth.users(id) on delete cascade`.
- `created_by -> auth.users(id) on delete set null`.
- `race_request_id -> race_requests(id) on delete set null`.
- `survey_campaign_id -> feedback_survey_campaigns(id) on delete set null`.

## Indexes

- `(user_id, created_at desc)` for inbox pagination.
- Partial `(user_id, created_at desc) where read_at is null` for badges.
- Partial indexes on non-null `race_request_id` and `created_by` cover foreign-key lookups and delete actions.
- Partial unique `(survey_campaign_id, user_id)`: a survey campaign reaches each runner once.

## RLS Policies

- Authenticated users select only their own rows and only the explicitly granted safe inbox columns.
- Authenticated users update only `read_at`, under matching owner `USING` and `WITH CHECK` policies.
- `anon` has no access. `service_role` has full access after the web route verifies trusted admin authority.
- The atomic race-request review RPC is `SECURITY INVOKER`, executable only by `service_role`.

## Business Invariants

- A requested external channel cannot have `not_requested`; an unrequested channel must have it.
- Delivery errors, provider ids and the admin actor are never client-readable.
- External delivery failure never deletes the in-app notification or rolls back an already-committed review.
- Reusing a notification UUID is idempotent only when status, admin actor, recipient, request, message and requested channels match.
- Survey notification ids are derived from `(campaign id, user id)`, so a retried campaign send inserts nothing new and only delivers rows still `pending`.

## Common Queries

The mobile inbox explicitly selects `id,user_id,race_request_id,feedback_id,kind,title,body,read_at,created_at`, filters by the authenticated owner and `deleted_at is null` (list, single load and unread badge), orders newest first, and uses the partial unread index for badge counts.

## Gotchas

- Column-level privileges intentionally make `select('*')` fail for client roles; mobile queries must list the safe columns.
- `push_notification_events` records per-device push attempts and deduplication. It is not the runner-visible inbox or read state.
- Delivery-state updates are service-only even though owners can see the notification content.
- Older app versions render a `feedback_survey` message as a plain admin message (no form): its default body asks the runner to update the app.

## Related Docs

- [race_requests](race-requests.md)
- [feedback_survey_campaigns](feedback-survey-campaigns.md)
- [feedback_survey_responses](feedback-survey-responses.md)
- [RLS Policies](../rls-policies.md)
- [Relationships](../relationships.md)
- [RLS Checklist](../../04-auth-and-security/rls-checklist.md)

## Admin read receipts

The admin inbox lists (`/api/admin/feedback`, `/api/admin/race-requests`) return, per item, the latest notification linked by `feedback_id` or `race_request_id` with its `read_at` and `deleted_at`, shown as "Lue le …", "Non lue" or "Supprimée par l'utilisateur".

The mobile query depends on `feedback_id` and `deleted_at`: apply `20261105180000_add_app_feedback_review.sql` before publishing the mobile update that reads them.

## Admin message history (2026-11-23, lot 5)

Every row is written by the service role after an admin action (`created_by` = the admin): the table holds no automatic notification. The `kind` gives the origin (`admin_message` written in the console — a bug / feedback reply carries `feedback_id` —, `race_request_status` sent with a race-request decision, `feedback_survey`). `GET /api/admin/user-notifications` (admin guard of the route) pages the history newest first, 30 per page, with `?recherche=` (case-insensitive on `title` and `body`; `*`, `,`, parentheses and quotes are stripped so the text cannot change the PostgREST `or` filter), `?type=message,demande,questionnaire`, `?destinataire=<userId>`; it selects the explicit admin columns (never `email_error`, `push_error`, `email_provider_id`) and resolves the recipient name and e-mail of the page only. The runner profile (`GET /api/admin/users/[id]`) reads the latest 50 rows of one runner the same way.
