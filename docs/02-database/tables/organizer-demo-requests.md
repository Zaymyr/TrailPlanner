---
title: organizer_demo_requests Table
scope: database
last_verified: 2026-11-23
ai_priority: medium
related_files:
  - supabase/migrations/20261116150000_add_organizer_demo_requests.sql
  - supabase/tests/organizer_demo_requests_checks.sql
  - apps/web/lib/organizer-demo-requests.ts
  - apps/web/lib/organizer-demo-requests.test.ts
  - apps/web/app/api/organizer-demo-requests/route.ts
  - apps/web/app/api/organizer-demo-requests/route.test.ts
  - apps/web/app/api/admin/organizer-demo-requests/route.ts
  - apps/web/app/api/admin/inbox-counts/route.ts
  - apps/web/app/admin/_components/AdminDemoRequestsSection.tsx
  - apps/web/app/admin/_components/AdminMessagingTab.tsx
  - apps/web/app/organisateurs/organizer-demo-request-form.tsx
related_tables:
  - organizer_demo_requests
---

# organizer_demo_requests Table

## Purpose

Stores demo requests sent by anonymous visitors from the « Demander une démo » form of `/organisateurs`. The admin reviews them in the admin inbox, tab « Demandes de course », above the runner race requests.

## Columns

`id` (uuid), `created_at`, `updated_at`, `email` (required), `race_url` (required, `http(s)://`), `phone` (optional), `attribution` (UTM keys only), `status` (`pending` / `completed` / `rejected`), generated `is_pending`, `reviewed_at`, `reviewed_by`, `admin_email_status` and `confirmation_email_status` (`sent` / `skipped` / `failed`).

## Access

Service-role only: RLS is enabled with no client policy and every client privilege is revoked. The public form posts to `POST /api/organizer-demo-requests` (IP rate limit 5 per hour, hidden honeypot field, zod validation, race link normalized to `https://`), which inserts the row and sends two Resend e-mails: one to the team (`ORGANIZER_DEMO_NOTIFY_EMAIL`, default the support mailbox, reply-to the organizer) and a receipt to the organizer. The e-mails do not depend on the insert, so a request still reaches the team while the migration is not deployed; the route fails only when the row was not stored and the team e-mail was not sent. `GET/PATCH /api/admin/organizer-demo-requests` are admin-only; the inbox badge adds pending demo requests to the race-request count and treats a missing table as zero.

## Gotchas

- No user account is linked: the reply happens by e-mail or phone, not through `user_notifications`.
- Deploy the migration through the production migration workflow after merging into `main`; before that, the admin section reports that the table is not deployed.
- The admin inbox also has a separate « Questionnaires » tab (feedback surveys); demo requests stay in « Demandes de course ».

- The form placeholders (`vous@votre-course.fr`, `www.votre-course.fr`) deliberately avoid the word "trail" because the landing targets running events in general (2026-11-22); this is copy only and changes no column or validation.

`pending` rows are counted separately (`demoRequests`) by `GET /api/admin/inbox-counts` for the « Démos organisateurs » badge; a missing table counts as 0.

Admin console (2026-11-22, lot 1): the « Démos organisateurs » list is reached at `/admin/inbox?vue=demos` (« À traiter »); `AdminMessagingTab` takes a `views` prop and that page leaves out the Questionnaires sub-tab, now at `/admin/messaging/surveys`. Old `/admin?onglet=messagerie&vue=demos` links redirect there. No change to the table, its route or its counts.

Admin console (2026-11-22, lot 2): `/admin/inbox` opens on the single « À traiter » queue; pending demo requests appear there (type « Démos organisateurs », late after 24 h) through `GET /api/admin/inbox` (`id, created_at, email, race_url`, service role, a missing table gives no item), and the row opens `/admin/inbox?vue=demos`, the « Traiter les messages » tab where `AdminMessagingTab` now keeps `?vue=` in the URL (`defaultView={null}`). `inbox-counts` still counts `demoRequests` the same way and adds system counts (failed flyovers, posts, renders, drafts, and since lot 3 the systems that are down). No change to the table.

## Admin audit journal (lot 7)

`app/api/admin/organizer-demo-requests/route.ts` now exports its write handler through `withAdminAudit` (`apps/web/lib/admin-audit-log.ts`): each successful or server-failed call writes one best-effort line (`organizer.demo`) to the admin action journal ([`admin_audit_log`](./admin-audit-log.md), shown in `/admin/system/audit`). The request and response contracts, the business rules and the schema described here are unchanged.
