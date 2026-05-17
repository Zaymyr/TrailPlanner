---
title: Session Management
scope: auth
last_verified: 2026-05-17
ai_priority: high
related_files:
  - apps/web/app/hooks/useVerifiedSession.tsx
  - apps/web/lib/auth-storage.ts
  - apps/web/app/api/auth/session/route.ts
  - apps/web/app/api/auth/signout/route.ts
  - apps/web/lib/trial-server.ts
related_tables:
  - user_profiles
  - subscriptions
---

# Session Management

## Purpose

This document describes how the web app stores, verifies, refreshes, and clears user sessions. Use it before changing auth storage keys or session refresh behavior.

## Key Concepts

- Stored session: localStorage access/refresh/email values.
- Verified session context: React context consumed by web app routes/components.
- Session update event: browser event used to notify tabs/components.
- Entitlements load: premium status fetched after session verification.

## Browser Storage Keys

`apps/web/lib/auth-storage.ts` uses:

- `trailplanner.accessToken`
- `trailplanner.refreshToken`
- `trailplanner.sessionEmail`

Persisting a session dispatches:

- `trailplanner:session-updated`

## Refresh Triggers

`useVerifiedSession` refreshes verification on:

- initial mount;
- page visibility/focus;
- browser storage changes;
- `trailplanner:session-updated`;
- periodic interval around 30 minutes.

## Sign Out

Clearing a session:

- posts to `/api/auth/signout`;
- clears stored auth tokens;
- clears race planner storage;
- resets entitlements to default free state.

## Server Verification

`/api/auth/session` returns:

- user id;
- email;
- role/roles;
- anonymous status;
- access and refresh tokens when refreshed;
- trial status through `ensureTrialStatus`.

The route also sets HTTP-only cookies for web requests.

## Gotchas

- Do not read localStorage values as proof of authentication. They are input to verification.
- Session refresh can race across tabs; handlers must be idempotent.
- Clearing planner storage on sign-out is intentional because anonymous/onboarding state can leak otherwise.
- Keep access-token and refresh-token handling synchronized with mobile/web session expectations.

## Related Docs

- [Auth Flows](auth-flows.md)
- [Duplicate Events Pattern](duplicate-events-pattern.md)
- [Plan Storage](../03-business-rules/plan-storage.md)
- [Trial Lifecycle](../03-business-rules/trial-lifecycle.md)
