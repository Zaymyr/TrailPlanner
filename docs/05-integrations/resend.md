---
title: Resend Integration
scope: integration
last_verified: 2026-05-19
ai_priority: medium
related_files:
  - package.json
  - apps/web/package.json
  - apps/web/lib/resend.ts
  - apps/web/app/api/resend/contact/route.ts
  - apps/web/app/api/resend/contact/route.test.ts
  - apps/web/app/api/admin/resend/sync/route.ts
  - apps/web/app/api/admin/resend/sync/route.test.ts
  - apps/web/app/hooks/useVerifiedSession.tsx
  - apps/mobile/app/_layout.tsx
  - apps/mobile/lib/resendContactSync.ts
  - apps/web/app/api/auth/session/route.ts
  - apps/web/app/api/coach/invite/route.ts
related_tables:
  - coach_invites
---

# Resend Integration

## Purpose

This document records the current Resend integration in the repo. Resend is used to sync Supabase Auth users into Resend Contacts through an admin bulk route and a per-user authenticated route. App-managed transactional email sending is still not implemented here.

## Key Concepts

- Resend: external email API provider.
- Resend Contacts: global contacts database used by Resend Broadcasts, Segments, and Topics.
- Supabase Auth email: email delivery managed by Supabase Auth configuration.
- Coach invite: app table and flow for connecting coach/coachee accounts.
- Admin sync: server-side route that reads Supabase Auth users with the service role and upserts matching Resend contacts.
- Identified-user sync: authenticated route used by web and mobile after a non-anonymous Supabase session is active.

## Current Status

The repo has two server-side Resend Contacts sync surfaces:

- `apps/web/lib/resend.ts` wraps the Resend Contacts REST API with `fetch`; no `resend` npm dependency is installed.
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
- is called by `apps/mobile/lib/resendContactSync.ts` from `apps/mobile/app/_layout.tsx` after a mobile non-anonymous session is active.

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
- coach invite records in `coach_invites`;
- UI/actions that can resend an invite conceptually through Supabase Auth, not Resend;
- no React Email templates or Resend email-sending route.

<!-- TODO: verify with maintainer: confirm whether production transactional email is handled fully by Supabase Auth/dashboard templates or by an external Resend setup outside this repo. -->

## Environment Variables

- `RESEND_API_KEY`: server-only Resend API key used by `apps/web/lib/resend.ts`.
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_ROLE`: server-only Supabase service role key used by the admin bulk route to list Auth users.

## Gotchas

- Do not expose `RESEND_API_KEY` or the Supabase service role key to client/mobile code.
- Resend Audiences are deprecated in the current Resend API navigation; use Contacts, Segments, and Topics for new sync work.
- The admin sync route imports contacts into Resend; it does not prove users opted into marketing. Keep `defaultUnsubscribed: true` unless consent is known.
- The authenticated web/mobile sync route is only for identified, non-anonymous users and currently sets `unsubscribed: false`.
- Web and mobile keep a local "already synced" marker, but Resend upsert behavior must remain idempotent because sessions can refresh or clients can retry.
- Resend custom contact properties must exist in Resend before syncing them. Keep `includeProperties: false` unless those fields are created in Resend.
- Resend can return `429` during large syncs. Keep the default request delay or run batches with `startPage`/`maxPages`.
- Do not add a Resend dependency unless SDK-specific behavior is needed; current code uses REST through `fetch`.
- Coach invite table behavior is not proof that app-managed email sending exists.

## Related Docs

- [Auth Flows](../04-auth-and-security/auth-flows.md)
- [Session Management](../04-auth-and-security/session-management.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [RLS Policies](../02-database/rls-policies.md)
