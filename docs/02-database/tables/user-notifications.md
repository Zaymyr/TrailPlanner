---
title: user_notifications Table
scope: database
last_verified: 2026-11-05
ai_priority: high
related_files:
  - supabase/migrations/20261105115106_admin_user_notifications.sql
  - supabase/tests/admin_user_notifications_checks.sql
related_tables:
  - user_notifications
  - race_requests
  - push_notification_events
---

# user_notifications Table

## Purpose

Stores the durable in-app inbox for messages sent by trusted administrators to one runner. The row is the source of truth even when optional Resend email or Expo push delivery is unavailable or fails.

## Key Concepts

- Notification kinds are `admin_message` and `race_request_status`.
- The application channel is mandatory; `email_requested` and `push_requested` are optional.
- Delivery statuses are `not_requested`, `pending`, `sent`, `failed`, or `unavailable`.
- Reading a notification changes only `read_at`.

## Columns

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key and cross-channel idempotency key. |
| `user_id` | uuid | Recipient Auth user; cascades on deletion. |
| `created_by` | uuid nullable | Admin audit actor; set null if deleted. |
| `race_request_id` | bigint nullable | Optional related request; set null if deleted. |
| `kind` | text | `admin_message` or `race_request_status`. |
| `title` | text | Trimmed, 1–160 characters. |
| `body` | text | Trimmed, 1–4000 characters. |
| `read_at` | timestamptz nullable | Owner read receipt. |
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

## Indexes

- `(user_id, created_at desc)` for inbox pagination.
- Partial `(user_id, created_at desc) where read_at is null` for badges.
- Partial indexes on non-null `race_request_id` and `created_by` cover foreign-key lookups and delete actions.

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

## Common Queries

The mobile inbox explicitly selects `id,user_id,race_request_id,kind,title,body,read_at,created_at`, filters by the authenticated owner, orders newest first, and uses the partial unread index for badge counts.

## Gotchas

- Column-level privileges intentionally make `select('*')` fail for client roles; mobile queries must list the safe columns.
- `push_notification_events` records per-device push attempts and deduplication. It is not the runner-visible inbox or read state.
- Delivery-state updates are service-only even though owners can see the notification content.

## Related Docs

- [race_requests](race-requests.md)
- [RLS Policies](../rls-policies.md)
- [Relationships](../relationships.md)
- [RLS Checklist](../../04-auth-and-security/rls-checklist.md)
