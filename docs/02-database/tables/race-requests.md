---
title: race_requests Table
scope: database
last_verified: 2026-11-11
ai_priority: high
related_files:
  - supabase/migrations/20261105180000_add_app_feedback_review.sql
  - supabase/tests/app_feedback_review_checks.sql
  - supabase/migrations/20260405173000_create_race_requests.sql
  - supabase/migrations/20261105115106_admin_user_notifications.sql
  - supabase/tests/admin_user_notifications_checks.sql
  - apps/mobile/components/race/RaceRequestHeaderButton.tsx
related_tables:
  - race_requests
  - user_notifications
---

# race_requests Table

## Purpose

Stores requests from authenticated runners asking Pace Yourself to add a race to the catalog. Runners create and read their own requests; trusted admin server routes review them.

## Key Concepts

- `pending`: the request still needs admin action.
- `completed`: the requested race work is finished.
- `rejected`: the request will not be fulfilled.
- Every admin review creates a mandatory owner-readable `user_notifications` row atomically.

## Columns

| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigint identity | Primary key. |
| `created_at` | timestamptz | Submission time. |
| `updated_at` | timestamptz | Maintained by trigger. |
| `user_id` | uuid | Request owner; defaults to `auth.uid()`. |
| `race_name` | text | Requested race name. |
| `location` | text | Requested location. |
| `requested_date` | date | Requested race date. |
| `status` | text | `pending`, `completed`, or `rejected`. |
| `reviewed_at` | timestamptz nullable | Last admin review time. |
| `reviewed_by` | uuid nullable | Reviewing Auth admin, cleared if that Auth user is deleted. |

## Foreign Keys

- `reviewed_by -> auth.users(id) on delete set null`.
- `user_notifications.race_request_id -> race_requests(id) on delete set null`; notification history survives request deletion.

## Indexes

- Primary key on `id`.
- Descending `created_at` index for admin queues.
- `user_id` index for owner history.
- Partial `reviewed_by` index for admin audit lookups.

## RLS Policies

- Authenticated runners may insert only rows whose `user_id` is their `auth.uid()`.
- Authenticated runners may select only their own rows.
- Clients have no direct update or delete grant. Admin review uses a trusted server route and the service-role-only `review_race_request_with_notification` RPC.

## Business Invariants

- The legacy `approved` status is migrated to `completed`; new rows cannot use `approved`.
- A status review and its in-app notification commit or roll back together.
- Admin authority is verified from Auth `app_metadata` by the server, never from `user_metadata` or `user_profiles.role`.

## Common Queries

Mobile owner history selects rows filtered by `user_id = auth.uid()`. Admin queue routes use service role, order by `created_at desc`, and return only the requested page/filter projection.

## Gotchas

- The original table did not reference `auth.users` from `user_id`; do not add that foreign key without first auditing existing rows.
- Retrying a review must reuse the same notification UUID so the RPC returns the existing matching notification instead of duplicating it.


## Mobile presentation

Forms and headers use the themed trail components: inputs are road-notebook `Field`s (units shown as cotes, searches with `variant="search"`), header and modal icon buttons are `IconAction` watch buttons (`tone="onBrand"` on forest headers) and back buttons are `IconAction variant="back"` sign blades. Parsing, validation and the data written are unchanged.

Submit and cancel actions use `ActionButton` (primary with a loading state, ghost cancel); payloads and writes are unchanged.

## Related Docs

- [user_notifications](user-notifications.md)
- [Schema Overview](../schema-overview.md)
- [RLS Policies](../rls-policies.md)
- [Migrations](../migrations.md)

## Admin ordering

`is_pending` (generated, `status = 'pending'`, added by `20261105180000_add_app_feedback_review.sql`) orders the admin list pending first; handled requests sink below and are greyed. The admin list also shows the last status message sent and whether the runner read or deleted it.
