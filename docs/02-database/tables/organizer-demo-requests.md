---
title: organizer_demo_requests Table
scope: database
last_verified: 2026-11-16
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
