---
title: Resend Integration
scope: integration
last_verified: 2026-09-23
ai_priority: medium
related_files:
  - package.json
  - apps/web/package.json
  - emails/resend/production-launch.html
  - emails/resend/production-launch.txt
  - apps/web/public/landing/mobile-app-plan-screen.jpeg
  - apps/web/lib/resend.ts
  - apps/web/lib/resend.test.ts
  - apps/web/app/api/resend/contact/route.ts
  - apps/web/app/api/resend/contact/route.test.ts
  - apps/web/app/api/admin/resend/sync/route.ts
  - apps/web/app/api/admin/resend/sync/route.test.ts
  - apps/web/app/hooks/useVerifiedSession.tsx
  - apps/mobile/app/_layout.tsx
  - apps/mobile/hooks/useSessionSideEffects.ts
  - apps/mobile/lib/resendContactSync.ts
  - apps/mobile/lib/resendContactSync.test.ts
  - apps/web/app/api/auth/session/route.ts
related_tables:
  - user_profiles
---

# Resend Integration

## Purpose

This document records the current Resend integration in the repo. Resend is used to sync Supabase Auth users into Resend Contacts through an admin bulk route and a per-user authenticated route, and to send the transactional notification that follows assignment of an existing organizer account to a race event. A static production-launch Broadcast template also lives in the repo.

## Key Concepts

- Resend: external email API provider.
- Resend Contacts: global contacts database used by Resend Broadcasts, Segments, and Topics.
- Resend Broadcasts: marketing/product emails managed from Resend, not from app runtime routes.
- Supabase Auth email: email delivery managed by Supabase Auth configuration.
- Admin sync: server-side route that reads Supabase Auth users with the service role and upserts matching Resend contacts.
- Identified-user sync: authenticated route used by web and mobile after a non-anonymous Supabase session is active.

## Current Status

The repo has one checked-in Broadcast template and two server-side Resend Contacts sync surfaces:

- `emails/resend/production-launch.html` is a static HTML template for the Google Play production launch Broadcast. Its support ask mentions both a Google Play rating and the `@pace_your.self` Instagram account.
- `emails/resend/production-launch.txt` is the matching plain-text copy.
- `apps/web/lib/resend.ts` wraps the Resend Contacts REST API with `fetch`; no `resend` npm dependency is installed.
- The same REST helper sends an existing organizer account a transactional e-mail only after its direct membership assignment or reactivation succeeds. The message names the canonical event and links to `/sign-in?next=...`, whose validated internal destination is `/organizer?eventId=...`; this makes an e-mail opened in a browser without the original local session authenticate before entering the selected event. Newly created accounts receive the Supabase invitation instead and do not receive this second message. Its checked-in HTML reuses the production-launch visual language (logo, beige canvas, bordered white card, green responsive CTA, and fallback URL) while remaining a transactional message without a marketing unsubscribe link or a Resend Dashboard template dependency.
- The web package also contains `tus-js-client` for Organizer Storage uploads and server-only `pdf-lib` for invoice PDFs; both are unrelated to Resend, which remains a direct REST integration without the Resend SDK.
- The root npm version is pinned for reliable Turbo/CI workspace discovery. Its `docs:check` and `verify` quality gates do not add a Resend SDK or change the REST contract.
- `apps/web/app/api/resend/contact/route.ts` exposes `POST /api/resend/contact` for the current authenticated user.
- `apps/web/app/api/resend/contact/route.test.ts` covers anonymous-user skipping, identified-user syncing, and Resend failure handling.
- `apps/web/app/api/admin/resend/sync/route.ts` exposes `POST /api/admin/resend/sync`.
- `apps/web/app/api/admin/resend/sync/route.test.ts` covers dry-run, create, and duplicate-update behavior.

The per-user contact route:

- requires a valid Supabase bearer access token;
- skips anonymous users and users without an email;
- rate-limits by Supabase user id;
- upserts the Resend contact without custom properties;
- always sends `unsubscribed: false` for identified users, per the current product decision;
- is called by `apps/web/app/hooks/useVerifiedSession.tsx` after web session verification;
- runs independently from the background entitlement refresh and does not extend the verified-session loading state;
- is called by `apps/mobile/lib/resendContactSync.ts` from `apps/mobile/hooks/useSessionSideEffects.ts` after a mobile non-anonymous session is active.
- stores its successful mobile idempotency marker under a SecureStore-safe key made from the user id and a SHA-256 digest of the normalized email; an email change therefore triggers a new sync without putting the address itself in the key.

`apps/mobile/app/_layout.tsx` also owns navigation-shell route options, including hiding the bottom tab bar during required onboarding and the light-system/dark-status-bar presentation. Keep those device presentation changes independent from the Resend sync trigger.
Its normal post-auth destination is the Courses catalog; changing that destination must not move or delay the identified-user contact sync.
The same layout marks owner/admin PostHog identities as internal, but that analytics classification remains independent from Resend contact eligibility and subscription state.

The admin bulk sync route:

- requires an admin bearer token;
- authorizes admin users through trusted Supabase `app_metadata` role/roles via `isAdminUser`;
- uses `SUPABASE_SERVICE_ROLE_KEY` server-side to page through `/auth/v1/admin/users`;
- reads `user_profiles.full_name` with the service role to populate contact names when available;
- upserts Resend contacts through the `/contacts` API;
- supports dry-runs and bounded pagination.

Request options:

```json
{
  "dryRun": true,
  "startPage": 1,
  "pageSize": 100,
  "maxPages": 5,
  "includeAnonymous": false,
  "includeProperties": false,
  "defaultUnsubscribed": true,
  "resendRequestDelayMs": 250
}
```

`defaultUnsubscribed` defaults to `true` for admin bulk imports so imported contacts are not automatically subscribed to Broadcasts without an explicit consent decision. The authenticated web/mobile per-user route is separate and intentionally uses `unsubscribed: false`.

`includeProperties` defaults to `false` because Resend rejects unknown custom properties with `422 One or more properties do not exist`. If properties are enabled and Resend rejects them, the route retries that contact without properties and counts it in `summary.propertiesDropped`.

`resendRequestDelayMs` defaults to `250` to stay under Resend's request rate limits. Use `startPage`, `pageSize`, and `maxPages` to run smaller batches when a deployment has a short function timeout.

The app still has:

- Supabase Auth flows for login/signup/password-related behavior;
- no React Email templates or Resend email-sending route.

The production-launch template is intended for Resend Broadcasts or manual dashboard use. It references public HTTPS assets served by the web app:

- `https://pace-yourself.com/branding/logo-horizontal-v2.png`
- `https://pace-yourself.com/landing/mobile-app-plan-screen.jpeg`

Keep those image paths stable while a Broadcast is live, or update the template before sending.

For future Broadcast creation and dashboard draft updates, use [Resend Broadcasts](resend-broadcasts.md). That playbook records the REST `segment_id` field name, verified sender-domain constraint, UTF-8-safe update path, and validation checklist.

## Environment Variables

- `RESEND_API_KEY`: server-only Resend API key used by `apps/web/lib/resend.ts`.
- `RESEND_FROM`: optional transactional sender override. When absent, the app uses the account's verified `Pace Yourself <hello@mail.pace-yourself.com>` sender.
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_ROLE`: server-only Supabase service role key used by the admin bulk route to list Auth users.

## Gotchas

- Do not expose `RESEND_API_KEY` or the Supabase service role key to client/mobile code.
- Resend Audiences are deprecated in the current Resend API navigation; use Contacts, Segments, and Topics for new sync work.
- The admin sync route imports contacts into Resend; it does not prove users opted into marketing. Keep `defaultUnsubscribed: true` unless consent is known.
- The authenticated web/mobile sync route is only for identified, non-anonymous users and currently sets `unsubscribed: false`.
- The production-launch template is marketing/product-announcement copy. Use it only for contacts with the appropriate consent/subscription status and keep the `{{{RESEND_UNSUBSCRIBE_URL}}}` link.
- For French or other non-ASCII Broadcast copy, upload with UTF-8-safe tooling such as Node `JSON.stringify`; avoid Windows PowerShell `ConvertTo-Json` for long email bodies.
- Email images should be public HTTPS PNG/JPG assets or Resend CID attachments for API sends. Avoid local file paths, SVGs, and large base64 data URIs in Broadcast HTML.
- Web and mobile keep a local "already synced" marker, but Resend upsert behavior must remain idempotent because sessions can refresh or clients can retry. Mobile marker keys may contain only alphanumeric characters, `.`, `-`, and `_`.
- A login-time session update may deliberately perform a second verification after an older request. Resend contact sync remains fire-and-forget and protected by the same per-user/e-mail marker.
- Invitation password creation waits for the shared verified-session refresh before entering `/organizer`; any resulting Resend contact sync remains fire-and-forget and cannot hold that navigation or session readiness open.
- Keep web contact sync fire-and-forget after session verification; neither contact sync nor the independent entitlement refresh should delay verified-session readiness.
- Do not tie Resend contact sync to onboarding tab-bar visibility; sync still depends on an identified, non-anonymous session.
- Resend custom contact properties must exist in Resend before syncing them. Keep `includeProperties: false` unless those fields are created in Resend.
- Resend can return `429` during large syncs. Keep the default request delay or run batches with `startPage`/`maxPages`.
- Do not add a Resend dependency unless SDK-specific behavior is needed; current code uses REST through `fetch`.
- Do not reuse the Organizer TUS upload client for email assets or contacts; Resend payloads continue through the bounded server-side REST helpers.
- Supabase Auth invitation e-mail behavior remains separate from Resend Contact syncing and the existing-account assignment notice. Never send both invitation variants for the same direct assignment.
- The organizer assignment notice is best-effort after membership persistence. Log a missing configuration or delivery failure without rolling back access that was already granted.

## Related Docs

- [Auth Flows](../04-auth-and-security/auth-flows.md)
- [Resend Broadcasts](resend-broadcasts.md)
- [Session Management](../04-auth-and-security/session-management.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [RLS Policies](../02-database/rls-policies.md)
