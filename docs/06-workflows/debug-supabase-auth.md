---
title: Debug Supabase Auth
scope: workflow
last_verified: 2026-09-23
ai_priority: high
related_files:
  - apps/web/app/api/auth/session/route.ts
  - apps/web/app/api/resend/contact/route.ts
  - apps/web/app/hooks/useVerifiedSession.tsx
  - apps/web/lib/entitlements-client.ts
  - apps/web/lib/supabase.ts
  - apps/web/lib/auth-storage.ts
  - apps/mobile/app/_layout.tsx
  - apps/mobile/hooks/useSessionSideEffects.ts
  - apps/mobile/lib/resendContactSync.ts
  - apps/mobile/lib/resendContactSync.test.ts
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
   If sign-in succeeds but the destination still looks signed out, verify that `trailplanner:session-updated` waits for any older in-flight refresh, that the older response cannot clear the new token, and that the provider then verifies the latest stored token.
   For an invite that remains on `Vérification de session...`, confirm the password page rejects non-200 session responses, awaits `refresh({ afterCurrent: true })`, and navigates client-side only after that refresh succeeds. In production logs, a successful password update and session endpoint followed by no second client verification indicates a redirect/hydration race rather than invalid credentials.
   For an existing-account assignment e-mail, confirm the CTA opens `/sign-in` with a URL-encoded `/organizer?eventId=<uuid>` return path. A direct Organizer visit whose verification endpoint stalls must leave the loading state after the 10-second browser timeout.
4. Distinguish verified-session readiness from the asynchronous entitlement state: `isLoading` can be false while `isEntitlementsLoading` is still true.
5. Verify whether the user is anonymous with `isAnonymousUser`.
6. Confirm `ensureTrialStatus` can read/write `user_profiles`.
7. If the issue is RLS, reproduce with authenticated JWT context or a manual SQL check.
8. If service routes work but client queries fail, inspect policies and grants.
9. If mobile differs, inspect `apps/mobile/app/_layout.tsx` for listener/navigation behavior and `apps/mobile/hooks/useSessionSideEffects.ts` for trial, Resend, and pending-conversion maintenance.
   For PostHog internal-user classification, confirm admin roles come from `session.user.app_metadata.role` / `roles` and that the owner email is normalized before comparison.
10. If the issue is Resend contact sync, confirm the session is not anonymous and then inspect `POST /api/resend/contact`. On mobile, an `Invalid key provided to SecureStore` error means the local idempotency marker regressed: its key must remain the safe `resend-contact-synced.<user-id>.<sha256-email>` form and must never contain the raw address or colon separators.
11. If the symptom is only bottom-tab availability during onboarding, inspect route options in `apps/mobile/app/(app)/_layout.tsx`; that is navigation-shell configuration, not an auth/session failure.
12. If a completed session opens the wrong root tab, verify that `getPostAuthRoute` and the tab navigator both use `catalog`; this is routing behavior, not an auth failure.
13. If a RaceBook cannot return to its previous screen or course search, or a header exposes a route template, inspect the nested race stack and the explicit hidden-screen options in `apps/mobile/app/(app)/_layout.tsx`; the header should use history when available and replace with Courses otherwise. These are navigation-shell issues, not session failures.
14. If login controls are obscured only with the iOS keyboard or enlarged text, inspect the login `ScrollView`/`KeyboardAvoidingView` layout; that is a presentation issue, not failed authentication.

## Useful Searches

```bash
rg -n "onAuthStateChange|SIGNED_IN|USER_UPDATED" apps
rg -n "ensureTrialStatus|trial_ends_at|trial_started_at" apps supabase
rg -n "create policy|auth.uid|app_metadata|user_metadata" supabase/migrations
rg -n "resend/contact|syncResendContact|resendContactSynced" apps
```

## Do Not

- Do not treat localStorage tokens as proof of auth.
- Do not diagnose a still-loading entitlement request as a failed session when the verified session is already available.
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
