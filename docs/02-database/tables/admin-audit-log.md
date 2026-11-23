---
title: admin_audit_log Table
scope: database
last_verified: 2026-11-23
ai_priority: medium
related_files:
  - supabase/migrations/20261123120000_admin_audit_log.sql
  - supabase/tests/admin_audit_log_checks.sql
  - apps/web/lib/admin-audit.ts
  - apps/web/lib/admin-audit.test.ts
  - apps/web/lib/admin-audit-log.ts
  - apps/web/lib/admin-audit-log.test.ts
  - apps/web/lib/admin-audit-server.ts
  - apps/web/app/api/admin/audit/route.ts
  - apps/web/app/api/admin/audit/route.test.ts
  - apps/web/app/admin/system/audit/page.tsx
  - apps/web/app/admin/_components/audit/AuditLog.tsx
  - apps/web/app/admin/_components/audit/AuditEntryDrawer.tsx
  - apps/web/app/admin/_components/audit/audit-api.ts
related_tables:
  - admin_audit_log
---

# `admin_audit_log`

## Purpose

Journal of the actions made from the admin console: who changed what, on which object, when, with a short French summary and a sanitized before/after. It answers « qui a fait quoi » for roles, Premium grants, sent messages, request handling, organizer access, packs and billing, catalogue edits, publications, automations, renders and maintenance. It backs `/admin/system/audit` (« Journal ») and the admin actions of the « Activité récente » card of `/admin`.

## Key Concepts

- One row per admin write (POST / PUT / PATCH / DELETE) that succeeded (`ok`) or failed on the server (`error`, HTTP 5xx or an action that reports its own failure such as a cron run answering `ok: false`). A request refused with a 4xx (not admin, invalid payload, unknown object, rate limit) did nothing and is not written. Reads are never written, including the read of the journal itself.
- Written best-effort by `recordAdminAction` (`apps/web/lib/admin-audit-log.ts`), mostly through the `withAdminAudit(handler, spec)` wrapper that every audited route exports: the handler, its response and its tests are unchanged; the wrapper reads a clone of the body and writes after the response is built. The insert has a 2 s timeout, errors are logged and swallowed, and a journal outage never fails or changes a request. Without the Supabase service configuration, or with `ADMIN_AUDIT_LOG_DISABLED=1` (set by `vitest.config.ts` so route tests that mock `fetch` call by call stay unchanged), nothing is written.
- The actor comes from the claims of the access token (`app_metadata` only, never `user_metadata`), after the route's own guard accepted it. `actor_label` is the masked e-mail (`fa***@gmail.com`) so a line stays readable after the account is deleted; the page shows the profile name when there is one.
- `action` is `domain.verb` (catalogue and French labels in `apps/web/lib/admin-audit.ts`, `AUDIT_ACTIONS`; a test checks that every action used in a route is declared). `target_type` + `target_id` identify the object; the page links to its sheet when it has one (`/admin/runners?coureur=`, `/admin/organizers?edition=`, `/admin/catalog/races?course=`, `/admin/content/posts?post=`, `/admin/content/renders?rendu=`, `/admin/content/flyovers?commande=`, `/admin/billing?ligne=`). Billing targets use the register ids (`organizer_invoice:<id>`, `organizer_pack:<id>`).
- `before` / `after` are sanitized by `sanitizeAuditValue` before they are stored: secrets, message content, files and contact details are replaced by `[non journalisé]`, e-mail addresses are masked, depth, width and length are bounded, and the whole document is capped (`jsonb` ≤ 16 KB by check). Most routes store a chosen subset of the request (`pickAuditFields`); message sends store the channels, never the title or body. `before` is only filled when a route knows the previous state (`noteAdminAudit`); today most rows have `before = null` and the drawer says so.
- Purged after 365 days by the pg_cron job `admin-audit-log-purge` (daily 04:37 UTC, `select public.purge_admin_audit_log();`, plain SQL, no pg_net).

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, `gen_random_uuid()` | Row id (`?entree=` of the page). |
| `created_at` | `timestamptz` | not null, now (UTC) | Time of the action (after the route answered). |
| `actor_user_id` | `uuid` | not null, no foreign key | Admin account. Not a foreign key on purpose: the journal outlives the account. |
| `actor_label` | `text` | null or ≤ 120 characters | Masked e-mail of the admin at that time. |
| `action` | `text` | not null, 3-80 characters, `^[a-z0-9][a-z0-9._-]*$` | `domain.verb`, e.g. `premium.grant`. |
| `target_type` | `text` | not null, 1-60 characters, slug | Kind of object (`user`, `edition`, `race`, `post`, `render`, `invoice`, `system`…). |
| `target_id` | `text` | null or ≤ 200 characters | Object id (uuid, numeric id or a register id). |
| `summary` | `text` | not null, 1-300 characters | One French sentence, e-mail addresses masked. |
| `before` | `jsonb` | null, ≤ 16 KB | Previous state when known (sanitized). |
| `after` | `jsonb` | null, ≤ 16 KB | Values written (sanitized). |
| `request_path` | `text` | null or ≤ 200 characters | `METHOD /api/...` of the request. |
| `status` | `text` | not null, `ok` / `error`, default `ok` | Result. |
| `error` | `text` | null or ≤ 300 characters | Short message of an `error` line. |

## Foreign Keys

None.

## Indexes

- `admin_audit_log_created_at_idx` on `created_at desc` (page, purge).
- `admin_audit_log_actor_created_at_idx` on `(actor_user_id, created_at desc)`.
- `admin_audit_log_target_idx` on `(target_type, target_id, created_at desc)`.
- `admin_audit_log_action_created_at_idx` on `(action, created_at desc)` (feed of the overview, family filter).

## RLS Policies

RLS is on with no policy; every privilege is revoked from `public`, `anon` and `authenticated`; `service_role` has `select`, `insert`, `delete` only (append-only: no update). Supabase's default privileges had given it every privilege; `20261123150000_admin_logs_service_privileges.sql` revokes them and grants these three again. The web server writes with the service role; `GET /api/admin/audit` (`authorizeVideoAdmin`) and the overview loader read it. `purge_admin_audit_log()` is `SECURITY DEFINER`, `search_path = ''`, executable by `service_role` only. Check script: `supabase/tests/admin_audit_log_checks.sql`.

## Business Invariants

- Never a password, token, message content, file content, contact detail or full e-mail address.
- A journal failure never fails, delays beyond 2 s or changes an admin request.
- Rows older than 365 days are deleted daily; lines are never updated.

## Common Queries

```sql
-- Latest admin actions of one admin
select created_at, action, summary, status from public.admin_audit_log
where actor_user_id = '<admin user id>' order by created_at desc limit 50;

-- Failed admin actions of the last 7 days
select created_at, action, summary, error from public.admin_audit_log
where status = 'error' and created_at > now() - interval '7 days' order by created_at desc;
```

## Gotchas

- Until the migration is applied, the table does not exist: writes only log a warning, `GET /api/admin/audit` answers `available: false` (the page says the journal is not enabled) and the overview feed shows no admin action.
- A new admin write route must export its handler through `withAdminAudit` and declare its action in `AUDIT_ACTIONS`, otherwise its changes are missing from the journal. Routes where an organizer, not only an admin, may act (`/api/products/*`, `/api/organizer/*`) write a line only when the token is an admin's.
- Routes not journaled on purpose: previews and AI generation (`organizer-invoices/preview`, `organizer-payments/preview`, `video-generator/caption|content|script|voice`), the `advance` polling step of a publication, a dry-run Resend sync, import previews, and every read.
- Each Resend sync page (a real run) is one line.

## Related Docs

- [Admin console redesign](../../08-decisions/2026-11-22-admin-console.md)
- [transactional_email_log](transactional-email-log.md)
- [Schema Overview](../schema-overview.md)
- [Web App Architecture](../../01-architecture/web-app.md)
