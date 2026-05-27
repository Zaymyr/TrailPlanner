---
title: Auth Flows
scope: auth
last_verified: 2026-05-27
ai_priority: high
related_files:
  - apps/web/app/api/auth/session/route.ts
  - apps/web/app/api/resend/contact/route.ts
  - apps/web/app/hooks/useVerifiedSession.tsx
  - apps/web/lib/auth-storage.ts
  - apps/web/lib/supabase.ts
  - apps/mobile/app/_layout.tsx
  - apps/mobile/app/(app)/onboarding.tsx
  - apps/mobile/app/(auth)/login.tsx
  - apps/mobile/app/(auth)/signup.tsx
  - apps/mobile/hooks/useAppleAuth.ts
  - apps/mobile/hooks/useGoogleAuth.ts
  - apps/mobile/lib/resendContactSync.ts
  - apps/mobile/lib/trial.ts
related_tables:
  - user_profiles
  - coach_invites
  - coach_coachees
---

# Auth Flows

## Purpose

This document explains how Pace Yourself verifies Supabase sessions and connects auth state to profile, trial, and coach invite behavior.

## Key Concepts

- Access token: bearer token sent to web API routes.
- Refresh token: token used by `/api/auth/session` to refresh an invalid access token.
- Verified session: client session state after server validation.
- Anonymous user: Supabase user whose app metadata provider is `anonymous`.
- Coach invite acceptance: server-side linking after session verification.

## Web Session Verification

`apps/web/app/hooks/useVerifiedSession.tsx` loads stored tokens and calls `apps/web/app/api/auth/session/route.ts`.

The route:

1. Reads the bearer access token.
2. Validates the token through Supabase Auth `/auth/v1/user`.
3. Attempts refresh when access token verification fails and a refresh token is present.
4. Calls `ensureTrialStatus` for the resolved user.
5. Accepts pending coach invites by email when a service-role config is present.
6. Returns normalized user/session data.
7. Sets HTTP-only auth cookies.

After a web session is verified, `useVerifiedSession` also calls `POST /api/resend/contact` once per `userId + email` browser storage marker. That route re-validates the bearer token, skips anonymous users, and only syncs identified users into Resend Contacts.

## Mobile Auth

`apps/mobile/app/_layout.tsx` listens to Supabase auth state. On active sessions it:

- stores session state;
- initializes trial status;
- handles guest merge/conversion flows;
- identifies analytics users when applicable;
- registers push tokens after session is active;
- syncs identified, non-anonymous users to Resend through the web API bridge.

Mobile account entry points live in `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/app/(auth)/signup.tsx`, and the guest onboarding account choice in `apps/mobile/app/(app)/onboarding.tsx`.

Non-auth onboarding steps, such as race/catalog selection UI, must not add separate session side effects; keep session, analytics identity, push registration, and Resend sync behavior in `_layout.tsx` or the existing dedicated helpers.
The onboarding route is registered as a non-tab screen so users do not get bottom-tab access while completing the required flow.

Social sign-in is split into hooks:

- `apps/mobile/hooks/useAppleAuth.ts` dynamically loads `expo-apple-authentication` on iOS, requests name and email scopes, signs in or links the Apple identity with Supabase ID-token auth, preserves the guest-merge fallback, stores the Apple full name when Apple returns it, and initializes trial status.
- `apps/mobile/hooks/useGoogleAuth.ts` exposes Google only on Android. It uses native Google Sign-In when the native client configuration is complete, and non-cancel native failures can fall back to browser OAuth.

Mobile social auth is platform-specific: iOS account surfaces show Sign in with Apple, while Android account surfaces show Google. If Google is ever reintroduced on iOS, Sign in with Apple must remain available as the equivalent privacy-preserving option required by App Store Guideline 4.8.

## Admin Detection

`apps/web/lib/supabase.ts` normalizes admin role from:

- `app_metadata.role`
- `app_metadata.roles`
- normalized `roles` array
- fallback user role shape returned by the helper

Do not use `user_metadata` for new authorization decisions.

## Coach Invite Acceptance

The web session route checks `coach_invites` after user verification. When a pending invite matches the user's email, the route inserts into `coach_coachees` and marks the invite accepted using service-role requests.

## Gotchas

- Token storage exists in browser localStorage, but session verification is server-backed.
- Guest accounts cannot start Stripe checkout; checkout rejects anonymous Supabase users.
- Trial repair runs during session verification and must stay idempotent.
- Coach invite acceptance should remain service-side because it links users across tables.
- Resend contact sync is a session side effect only for identified users; anonymous sessions must continue to be skipped on both web and mobile.
- Do not render Google sign-in on iOS builds; App Review devices should only see the Apple social login path.

## Related Docs

- [Session Management](session-management.md)
- [Duplicate Events Pattern](duplicate-events-pattern.md)
- [Trial Lifecycle](../03-business-rules/trial-lifecycle.md)
- [RLS Checklist](rls-checklist.md)
