---
title: Debug Supabase Auth
scope: workflow
last_verified: 2026-06-18
ai_priority: high
related_files:
  - apps/web/app/api/auth/session/route.ts
  - apps/web/app/api/resend/contact/route.ts
  - apps/web/app/hooks/useVerifiedSession.tsx
  - apps/web/lib/supabase.ts
  - apps/web/lib/auth-storage.ts
  - apps/mobile/app/_layout.tsx
  - apps/mobile/lib/resendContactSync.ts
related_tables:
  - user_profiles
  - subscriptions
---

# Debug Supabase Auth

## Purpose

Use this workflow when a user cannot sign in, a session is stale, trial state is wrong, or RLS behavior differs between client and server.

## Key Concepts

- Bearer token: access token passed to web API routes.
- Refresh token: token used to refresh invalid access tokens.
- Verified session: server-confirmed user state.
- RLS context: database role and JWT claims used in policy evaluation.

## Steps

1. Read [../04-auth-and-security/auth-flows.md](../04-auth-and-security/auth-flows.md).
2. Check the web session context path in `apps/web/app/hooks/useVerifiedSession.tsx`.
3. Check `/api/auth/session` response handling in `apps/web/app/api/auth/session/route.ts`.
4. Verify whether the user is anonymous with `isAnonymousUser`.
5. Confirm `ensureTrialStatus` can read/write `user_profiles`.
6. If the issue is RLS, reproduce with authenticated JWT context or a manual SQL check.
7. If service routes work but client queries fail, inspect policies and grants.
8. If mobile differs, inspect `apps/mobile/app/_layout.tsx` and mobile session helpers.
9. If the issue is Resend contact sync, confirm the session is not anonymous and then inspect `POST /api/resend/contact`.
10. If the symptom is only bottom-tab availability during onboarding, inspect route options in `apps/mobile/app/(app)/_layout.tsx`; that is navigation-shell configuration, not an auth/session failure.

## Useful Searches

```bash
rg -n "onAuthStateChange|SIGNED_IN|USER_UPDATED" apps
rg -n "ensureTrialStatus|trial_ends_at|trial_started_at" apps supabase
rg -n "create policy|auth.uid|app_metadata|user_metadata" supabase/migrations
rg -n "resend/contact|syncResendContact|resendContactSynced" apps
```

## Do Not

- Do not treat localStorage tokens as proof of auth.
- Do not query `auth.users` from client code.
- Do not use service-role success as proof that RLS is correct.
- Do not add `user_metadata` admin checks.
- Do not debug Resend contact sync from the mobile secret layer; mobile should only send the Supabase access token to the web bridge.
- Do not treat hidden onboarding tabs as proof that auth or RLS is working; verify the actual session and policy path.

## Related Docs

- [Session Management](../04-auth-and-security/session-management.md)
- [Duplicate Events Pattern](../04-auth-and-security/duplicate-events-pattern.md)
- [RLS Policies](../02-database/rls-policies.md)
- [Trial Lifecycle](../03-business-rules/trial-lifecycle.md)
