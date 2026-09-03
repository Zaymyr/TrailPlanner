---
title: Auth Flows
scope: auth
last_verified: 2026-09-03
ai_priority: high
related_files:
  - apps/web/app/sign-in/page.tsx
  - apps/web/app/sign-up/page.tsx
  - apps/web/app/auth/callback/page.tsx
  - apps/web/app/sign-in/auth-errors.test.ts
  - apps/web/app/api/auth/signin/route.ts
  - apps/web/app/api/auth/session/route.ts
  - apps/web/app/api/resend/contact/route.ts
  - apps/web/app/hooks/useVerifiedSession.tsx
  - apps/web/lib/entitlements-client.ts
  - apps/web/lib/auth-storage.ts
  - apps/web/lib/auth-errors.ts
  - apps/web/lib/oauth.ts
  - apps/web/lib/organizer-acquisition.ts
  - apps/web/lib/organizer-acquisition.test.ts
  - apps/web/lib/supabase.ts
  - apps/mobile/app/_layout.tsx
  - apps/mobile/app/(app)/onboarding.tsx
  - apps/mobile/app/(auth)/login.tsx
  - apps/mobile/app/(auth)/signup.tsx
  - apps/mobile/hooks/useAppleAuth.ts
  - apps/mobile/hooks/useGoogleAuth.ts
  - apps/mobile/lib/onboardingGate.ts
  - apps/mobile/lib/resendContactSync.ts
  - apps/mobile/lib/trial.ts
related_tables:
  - user_profiles
---

# Auth Flows

## Purpose

This document explains how Pace Yourself verifies Supabase sessions and connects auth state to profile and trial behavior.

## Key Concepts

- Access token: bearer token sent to web API routes.
- Refresh token: token used by `/api/auth/session` to refresh an invalid access token.
- Verified session: client session state after server validation.
- Anonymous user: Supabase user whose app metadata provider is `anonymous`.

## Web Session Verification

`apps/web/app/hooks/useVerifiedSession.tsx` loads stored tokens and calls `apps/web/app/api/auth/session/route.ts`.

The route:

1. Reads the bearer access token.
2. Validates the token through Supabase Auth `/auth/v1/user`.
3. Attempts refresh when access token verification fails and a refresh token is present.
4. Calls `ensureTrialStatus` for the resolved user.
5. Returns normalized user/session data.
6. Sets HTTP-only auth cookies.

After a web session is verified, `useVerifiedSession` exposes the verified session immediately and refreshes premium entitlements in the background through their separate loading state. It also calls `POST /api/resend/contact` once per `userId + email` browser storage marker. That route re-validates the bearer token, skips anonymous users, and only syncs identified users into Resend Contacts.

## Web Password Sign-In Errors

`apps/web/app/api/auth/signin/route.ts` converts Supabase password-sign-in failures into a small, stable error-code contract instead of forwarding provider messages. `apps/web/app/sign-in/page.tsx` maps `invalid_credentials` to the active locale and uses the localized generic sign-in error for every other failure. The invalid-credentials wording must stay generic about whether the email address exists.

## Web Return Destinations

The organizer acquisition flow may send `next=/organizers` through password sign-in, immediate sign-up, or the OAuth callback. `apps/web/lib/organizer-acquisition.ts` accepts only that exact internal pathname, retains only the five supported UTM parameters, and falls back to `/race-planner` for missing, external, protocol-relative, backslash-based, malformed, or unsupported destinations. OAuth providers receive the validated destination nested in the existing `/auth/callback` URL; the callback validates it again before navigation.

## Mobile Auth

`apps/mobile/app/_layout.tsx` listens to Supabase auth state. On active sessions it:

- stores session state;
- initializes trial status;
- handles guest merge/conversion flows;
- identifies analytics users when applicable;
- registers push tokens after session is active;
- syncs identified, non-anonymous users to Resend through the web API bridge.

Mobile account entry points live in `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/app/(auth)/signup.tsx`, and the guest onboarding account choice in `apps/mobile/app/(app)/onboarding.tsx`.
The session shell resolves required onboarding before navigation; otherwise it opens the Courses catalog directly and does not preload the Plans screen.

Non-auth onboarding steps, such as race/catalog selection UI, must not add separate session side effects; keep session, analytics identity, push registration, and Resend sync behavior in `_layout.tsx` or the existing dedicated helpers.
The onboarding race chooser inner-filters event formats to `races.is_live = true`. This visibility filter is catalog behavior only and must not add a new authentication/session side effect.
`apps/mobile/lib/onboardingGate.ts` decides whether the initial chooser or an in-progress tour should reopen after auth. Two durable owner-scoped statuses distinguish Plan and RaceBook. The gate shows the chooser only while both are untouched, resumes a stored in-progress stage on cold start, and otherwise opens Courses. The status migration marks Plan completed for existing profiles while leaving RaceBook pending; profiles created afterward start with both tours pending.
When onboarding does reopen for an identified user, `apps/mobile/app/(app)/onboarding.tsx` should hydrate existing `user_profiles` values and favorite products before the runner edits anything, so revisits do not appear empty or overwrite stored profile defaults unintentionally.
The Plan setup route hides the bottom tab bar. Once a tour reaches Courses, Nutrition, Plan, or RaceBook, the real route and ordinary tab navigation remain available with a contextual guide. Skipping persists that tour as `skipped`; dismissing the initial chooser skips both. Neither action is treated as completion.

Social sign-in is split into hooks:

- `apps/mobile/hooks/useAppleAuth.ts` dynamically loads `expo-apple-authentication` on iOS, requests name and email scopes, signs in or links the Apple identity with Supabase ID-token auth, hashes the Apple nonce challenge with `expo-crypto` while passing the raw nonce to Supabase for verification, preserves the guest-merge fallback when anonymous identity linking reports an already-linked or already-existing account, stores the Apple full name when Apple returns it, and initializes trial status.
- `apps/mobile/hooks/useGoogleAuth.ts` exposes Google only on Android. It uses native Google Sign-In when the native client configuration is complete, and non-cancel native failures can fall back to browser OAuth.

Mobile social auth is platform-specific: iOS account surfaces show Sign in with Apple, while Android account surfaces show Google. If Google is ever reintroduced on iOS, Sign in with Apple must remain available as the equivalent privacy-preserving option required by App Store Guideline 4.8.

## Admin Detection

`apps/web/lib/supabase.ts` normalizes admin role from:

- `app_metadata.role`
- `app_metadata.roles`
- normalized `roles` array
- fallback user role shape returned by the helper

Do not use `user_metadata` for new authorization decisions.

## Gotchas

- Token storage exists in browser localStorage, but session verification is server-backed.
- Session readiness does not imply that premium entitlements have finished loading; consumers that require the resolved rights must also observe `isEntitlementsLoading`.
- Do not render Supabase Auth `msg` values directly; provider messages are not localized and can expose technical details.
- Never pass an unvalidated `next` value to `router.push`, `router.replace`, or an OAuth callback URL.
- Guest accounts cannot start Stripe checkout; checkout rejects anonymous Supabase users.
- Trial repair runs during session verification and must stay idempotent.
- Resend contact sync is a session side effect only for identified users; anonymous sessions must continue to be skipped on both web and mobile.
- Do not key the mobile onboarding gate off a single nullable profile field. Returning users can have partial profiles, and reopening onboarding with empty local state risks resaving nulls over durable defaults.
- A skip action must persist the relevant per-tour status before navigation. AsyncStorage is only a resume cursor, never the durable completion source.
- Do not render Google sign-in on iOS builds; App Review devices should only see the Apple social login path.
- For Apple ID-token auth, send Apple the hashed nonce challenge and Supabase the raw nonce. The Apple authorization code is not a provider access token for Supabase `signInWithIdToken`.
- Anonymous Apple identity linking can return existing-account wording when the Apple ID was used in an earlier review attempt; keep that path recoverable through direct Apple ID-token sign-in plus the pending guest-merge flow.

## Related Docs

- [Session Management](session-management.md)
- [Duplicate Events Pattern](duplicate-events-pattern.md)
- [Trial Lifecycle](../03-business-rules/trial-lifecycle.md)
- [RLS Checklist](rls-checklist.md)
