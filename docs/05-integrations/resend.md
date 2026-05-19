---
title: Resend Integration
scope: integration
last_verified: 2026-05-19
ai_priority: medium
related_files:
  - package.json
  - apps/web/package.json
  - apps/web/lib/resend.ts
  - apps/web/app/api/admin/resend/sync/route.ts
  - apps/web/app/api/admin/resend/sync/route.test.ts
  - apps/web/app/api/auth/session/route.ts
  - apps/web/app/api/coach/invite/route.ts
related_tables:
  - coach_invites
---

# Resend Integration

## Purpose

This document records the current Resend integration in the repo. Resend is currently used for an admin-only Supabase Auth user to Resend Contacts sync. App-managed transactional email sending is still not implemented here.

## Key Concepts

- Resend: external email API provider.
- Resend Contacts: global contacts database used by Resend Broadcasts, Segments, and Topics.
- Supabase Auth email: email delivery managed by Supabase Auth configuration.
- Coach invite: app table and flow for connecting coach/coachee accounts.
- Admin sync: server-side route that reads Supabase Auth users with the service role and upserts matching Resend contacts.

## Current Status

The repo has a server-side Resend Contacts sync:

- `apps/web/lib/resend.ts` wraps the Resend Contacts REST API with `fetch`; no `resend` npm dependency is installed.
- `apps/web/app/api/admin/resend/sync/route.ts` exposes `POST /api/admin/resend/sync`.
- `apps/web/app/api/admin/resend/sync/route.test.ts` covers dry-run, create, and duplicate-update behavior.

The sync route:

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
  "pageSize": 100,
  "maxPages": 5,
  "includeAnonymous": false,
  "includeProperties": true,
  "defaultUnsubscribed": true
}
```

`defaultUnsubscribed` defaults to `true` so imported contacts are not automatically subscribed to Broadcasts without an explicit consent decision. Set it to `false` only when consent is handled outside this route.

The app still has:

- Supabase Auth flows for login/signup/password-related behavior;
- coach invite records in `coach_invites`;
- UI/actions that can resend an invite conceptually through Supabase Auth, not Resend;
- no React Email templates or Resend email-sending route.

<!-- TODO: verify with maintainer: confirm whether production transactional email is handled fully by Supabase Auth/dashboard templates or by an external Resend setup outside this repo. -->

## Environment Variables

- `RESEND_API_KEY`: server-only Resend API key used by `apps/web/lib/resend.ts`.
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_ROLE`: server-only Supabase service role key used to list Auth users.

## Gotchas

- Do not expose `RESEND_API_KEY` or the Supabase service role key to client/mobile code.
- Resend Audiences are deprecated in the current Resend API navigation; use Contacts, Segments, and Topics for new sync work.
- The sync route imports contacts into Resend; it does not prove users opted into marketing. Keep `defaultUnsubscribed: true` unless consent is known.
- Do not add a Resend dependency unless SDK-specific behavior is needed; current code uses REST through `fetch`.
- Coach invite table behavior is not proof that app-managed email sending exists.

## Related Docs

- [Auth Flows](../04-auth-and-security/auth-flows.md)
- [Session Management](../04-auth-and-security/session-management.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [RLS Policies](../02-database/rls-policies.md)
