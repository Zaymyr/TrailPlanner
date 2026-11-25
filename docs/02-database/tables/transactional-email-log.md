---
title: transactional_email_log Table
scope: database
last_verified: 2026-11-23
ai_priority: medium
related_files:
  - supabase/migrations/20261123090000_admin_system_health.sql
  - supabase/tests/admin_system_health_checks.sql
  - apps/web/lib/transactional-email-log.ts
  - apps/web/lib/transactional-email-log.test.ts
  - apps/web/lib/resend.ts
  - apps/web/lib/admin-system-health.ts
  - apps/web/lib/admin-system-health-server.ts
related_tables:
  - transactional_email_log
---

# `transactional_email_log`

## Purpose

Journal of the transactional e-mails sent through Resend, so the admin console can say whether e-mails leave (« E-mails (Resend) » health line of `/admin`, Resend card of `/admin/system/integrations`, « Système » item of the queue when they are down). Before it, no send left any trace in the database. It stores what happened, never what was sent: no subject, no body, no full address.

## Key Concepts

- One row per attempt of `sendTransactionalEmail`, `sendOrganizerAssignmentEmail` and `sendAdminUserNotificationEmail` (`apps/web/lib/resend.ts`), written by `recordTransactionalEmail` (`apps/web/lib/transactional-email-log.ts`).
- Best-effort: the insert has a 2.5 s timeout, its errors are logged and swallowed, and it never changes the result of the send.
- Purged after 90 days by the pg_cron job `transactional-email-log-purge` (daily 04:23 UTC, `select public.purge_transactional_email_log();`, SQL only, no pg_net).

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, `gen_random_uuid()` | Row id. |
| `created_at` | `timestamptz` | not null, now (UTC) | Time of the attempt (after Resend answered). |
| `category` | `text` | not null, 1-80 characters, `^[a-z0-9][a-z0-9/_-]*$` | Kind of e-mail without ids: the optional `category` argument, else the idempotency key without its ids (`flyover/paid/<id>` → `flyover/paid`, `flyover/ready/<id>/<updated_at>` → `flyover/ready`, `organizer-demo/admin/<id>` → `organizer-demo/admin`), `organizer-assignment`, `admin-user-notification`, or `transactional` for a key without `/`. |
| `status` | `text` | not null, `sent` / `skipped` / `failed` | `skipped`: Resend not configured (`RESEND_API_KEY` missing). `failed`: Resend refused, or the request threw (network). |
| `status_code` | `integer` | null or 0-999 | HTTP status of a refusal. |
| `message` | `text` | null or ≤ 300 characters | One-line provider message of a failure; e-mail addresses it quotes are masked. |
| `recipient_masked` | `text` | null or ≤ 120 characters | `fa***@gmail.com`: two characters of the local part (one when it is that short) and the domain. |
| `provider_message_id` | `text` | null or ≤ 100 characters | Resend e-mail id of a sent message, to find it in the Resend dashboard. |

## Foreign Keys

None: a row points to no user, order or notification (the category tells the kind, the masked recipient is enough to recognise a provider problem).

## Indexes

- `transactional_email_log_created_at_idx` on `created_at desc` (latest rows, 24 h window, purge).
- `transactional_email_log_status_created_at_idx` on `(status, created_at desc)`.

## RLS Policies

RLS is on with no policy; every privilege is revoked from `public`, `anon` and `authenticated`; `service_role` has `select`, `insert`, `delete` only (no update or truncate: Supabase's default privileges are revoked by `20261123150000_admin_logs_service_privileges.sql`). The web server writes with the service role; the admin routes (`authorizeVideoAdmin`) read it through `lib/admin-system-health-server.ts`. `purge_transactional_email_log()` is `SECURITY DEFINER`, `search_path = ''`, executable by `service_role` only.

## Business Invariants

- Never the content (subject, HTML, text, reply-to) nor a full recipient address.
- A journal failure never fails, delays beyond 2.5 s or changes an e-mail send.
- Rows older than 90 days are deleted daily.

## Common Queries

```sql
-- Failures of the last 24 h by category
select category, count(*) from public.transactional_email_log
where status = 'failed' and created_at > now() - interval '24 hours'
group by category order by 2 desc;
```

## Gotchas

- Until the migration is applied, the table does not exist: the console shows the e-mail line as `unknown` (« Journal des e-mails illisible ») and the writer only logs a warning.
- Supabase Auth e-mails (invitations, magic links) and Resend Broadcasts do not go through `lib/resend.ts` and are not journaled.
- Keep new sending helpers on `sendLoggedEmail` (or call `recordTransactionalEmail`) so the health line stays complete.

## Related Docs

- [Resend Integration](../../05-integrations/resend.md)
- [Admin system health functions](../admin-system-health-functions.md)
- [Web App Architecture](../../01-architecture/web-app.md)

Since 2026-11-23 `admin-system-health.ts` also attaches a « Que faire ? » remedy to failing scheduled tasks; the e-mail health line is unchanged.

Refactor (2026-11-23, admin console lot 4): `lib/admin-system-health-server.ts` now uses the shared Data API helpers of `lib/admin-service-rest.ts`; the journal reads, columns and masking are unchanged.
