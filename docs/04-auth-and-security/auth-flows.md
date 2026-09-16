---
title: Auth Flows
scope: auth
last_verified: 2026-09-16
ai_priority: high
related_files:
  - apps/web/app/sign-in/page.tsx
  - apps/web/app/sign-up/page.tsx
  - apps/web/app/auth/callback/page.tsx
  - apps/web/app/reset-password/page.tsx
  - apps/web/app/reset-password/page.test.ts
  - apps/web/app/sign-in/auth-errors.test.ts
  - apps/web/app/api/auth/signin/route.ts
  - apps/web/app/api/auth/password-update/route.ts
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
  - apps/mobile/hooks/useSessionSideEffects.ts
  - apps/mobile/app/(app)/onboarding.tsx
  - apps/mobile/app/(auth)/login.tsx
  - apps/mobile/app/(auth)/signup.tsx
  - apps/mobile/hooks/useAppleAuth.ts
  - apps/mobile/hooks/useGoogleAuth.ts
  - apps/mobile/hooks/useGuestAccountPrompt.ts
  - apps/mobile/hooks/useProfileScreen.ts
  - apps/mobile/hooks/profileScreenHelpers.ts
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

A session-update event raised while a previous verification is still running queues one verification from the latest stored tokens. The older response cannot clear or overwrite those newer tokens. Password sign-in can therefore navigate directly to `/organizers` without requiring a browser reload to expose the authenticated creation form.

## Web Password Sign-In Errors

`apps/web/app/api/auth/signin/route.ts` converts Supabase password-sign-in failures into a small, stable error-code contract instead of forwarding provider messages. `apps/web/app/sign-in/page.tsx` maps `invalid_credentials` to the active locale and uses the localized generic sign-in error for every other failure. The invalid-credentials wording must stay generic about whether the email address exists.

## Web Return Destinations

The organizer acquisition flow may send `next=/organizers` (event creation) or `next=/organizer` (the authenticated dashboard) through password sign-in, immediate sign-up, or the OAuth callback. `apps/web/lib/organizer-acquisition.ts` accepts only these exact internal pathnames. It retains only the five supported UTM parameters for `/organizers` and strips query parameters from `/organizer`; it falls back to `/race-planner` for missing, external, protocol-relative, backslash-based, malformed, or unsupported destinations. OAuth providers receive the validated destination nested in the existing `/auth/callback` URL; the callback validates it again before navigation.

An admin-created organizer account follows the Supabase invitation flow rather than receiving an application-generated password. The protected admin route passes `/reset-password` through GoTrue's `redirect_to` query parameter and includes the canonical race name as `user_metadata.event_name` (`{{ .Data.event_name }}` in the Supabase invite template). That metadata is display-only and must never authorize access. The password page accepts both `invite` and `recovery` token fragments, updates the password through the anon-key server route, verifies and persists the resulting session, then sends an invite flow to `/organizer`; ordinary password recovery still returns to `/race-planner`. The organizer membership is created before the e-mail is sent, so the first verified dashboard load is already authorized.

## Mobile Auth

The authenticated onboarding catalog accepts source-backed formats whose D+ is still unpublished. It shows the missing value explicitly and does not allow that format to start plan calculation until the elevation is supplied; this does not alter authentication or onboarding-gate state.

`apps/mobile/app/_layout.tsx` listens to Supabase auth state. On active sessions it:

- stores session state;
- initializes trial status;
- handles guest merge/conversion flows;
- identifies analytics users when applicable;
- marks the owner email and trusted `app_metadata` admins as PostHog internal/test users;
- registers push tokens after session is active;
- syncs identified, non-anonymous users to Resend through the web API bridge.

The root keeps auth navigation and analytics identity. `useSessionSideEffects` encapsulates only idempotent trial, Resend, and pending account/guest conversion maintenance.

Mobile account entry points live in `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/app/(auth)/signup.tsx`, and the guest onboarding account choice in `apps/mobile/app/(app)/onboarding.tsx`.
Guest-only feature gates reuse `apps/mobile/hooks/useGuestAccountPrompt.ts`. It presents separate account-creation and existing-account sign-in choices, then routes through those same auth screens so guest conversion/merge behavior remains centralized. The race-favorite and additional-plan gates invoke it before optimistic UI or persistence.
The onboarding route injects the guest account controls into its extracted presentational overview component. Apple/Google callbacks, loading state, guest continuation, and auth errors remain owned by the route so the component split does not create a second authentication lifecycle.
The password-login inputs and submit action expose stable `auth-login-*` test ids and localized accessibility labels. The Maestro UX journey uses those hooks so translations can change without breaking authentication tests. Credentials enter the process through ignored local environment files or secret EAS `preview` variables; they are never embedded in the app bundle or flow YAML.
Login uses the same scrollable keyboard-avoidance layout as signup, so account actions remain reachable when the iOS keyboard is open or Dynamic Type enlarges the form.
The session shell resolves required onboarding before navigation; otherwise it opens the Courses catalog directly and does not preload the Plans screen.

Non-auth onboarding steps, such as the extracted race/catalog and nutrition-product presentation components, must not add separate session side effects; their callbacks remain owned by the onboarding route, while session, analytics identity, push registration, and Resend sync behavior stay in `_layout.tsx` or the existing dedicated helpers.
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

Mobile Profile admin/debug presentation follows the same boundary: it accepts only `app_metadata.role` and `app_metadata.roles`. It does not fall back to the user-editable `user_metadata.role` field.

## Gotchas

- Token storage exists in browser localStorage, but session verification is server-backed.
- Session readiness does not imply that premium entitlements have finished loading; consumers that require the resolved rights must also observe `isEntitlementsLoading`.
- Do not render Supabase Auth `msg` values directly; provider messages are not localized and can expose technical details.
- Never pass an unvalidated `next` value to `router.push`, `router.replace`, or an OAuth callback URL.
- Only `/organizer` and `/organizers` are valid organizer return destinations; do not expand this allowlist without a dedicated redirect-security review.
- Keep the Supabase invitation redirect allowlist configured for the deployed `/reset-password` URL, and pass that URL as the invite endpoint's `redirect_to` query parameter rather than a JSON-body field. If either condition is missed, Supabase falls back to the project Site URL and the invited organizer cannot reach the password-creation screen directly.
- Guest accounts cannot start Stripe checkout; checkout rejects anonymous Supabase users.
- Guest feature prompts must route through the existing login/signup screens rather than implementing provider or password auth inside the gated screen.
- Trial repair runs during session verification and must stay idempotent.
- Resend contact sync is a session side effect only for identified users; anonymous sessions must continue to be skipped on both web and mobile.
- Do not key the mobile onboarding gate off a single nullable profile field. Returning users can have partial profiles, and reopening onboarding with empty local state risks resaving nulls over durable defaults.
- A skip action must persist the relevant per-tour status before navigation. AsyncStorage is only a resume cursor, never the durable completion source.
- Do not render Google sign-in on iOS builds; App Review devices should only see the Apple social login path.
- Analytics classification may read admin roles only from trusted `app_metadata.role` / `app_metadata.roles`, never `user_metadata`.
- For Apple ID-token auth, send Apple the hashed nonce challenge and Supabase the raw nonce. The Apple authorization code is not a provider access token for Supabase `signInWithIdToken`.
- Anonymous Apple identity linking can return existing-account wording when the Apple ID was used in an earlier review attempt; keep that path recoverable through direct Apple ID-token sign-in plus the pending guest-merge flow.
- A clean E2E install follows the real anonymous-session bootstrap before opening password login. Do not add a production auth bypass for tests; use a dedicated test account and keep test credentials out of `EXPO_PUBLIC_*` variables.

## Related Docs

- [Session Management](session-management.md)
- [Duplicate Events Pattern](duplicate-events-pattern.md)
- [Trial Lifecycle](../03-business-rules/trial-lifecycle.md)
- [RLS Checklist](rls-checklist.md)
