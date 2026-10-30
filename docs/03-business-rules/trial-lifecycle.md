---
title: Trial Lifecycle
scope: business-rule
last_verified: 2026-10-30
ai_priority: high
related_files:
  - apps/web/lib/trial.ts
  - apps/web/lib/trial-server.test.ts
  - supabase/migrations/20261030115828_stop_automatic_runner_trials.sql
  - apps/web/lib/trial-server.ts
  - apps/mobile/lib/trial.ts
  - apps/mobile/lib/fetchWithTimeout.ts
  - supabase/migrations/20260408100000_initialize_trial_profile_on_user_created.sql
  - apps/web/app/api/auth/session/route.ts
  - apps/web/app/layout.tsx
related_tables:
  - user_profiles
---

# Historical Trial Lifecycle

## Purpose

Automatic 15-day Premium trials are retired for newly created accounts. Previously started trials remain valid until their recorded end. Paid store subscriptions and their billing status `trialing` are separate from this historical application trial.

## Creation and migration

The historical `20260408100000_initialize_trial_profile_on_user_created.sql` granted trial dates when Auth created a user. The replacement `20261030115828_stop_automatic_runner_trials.sql` keeps the same Auth trigger and creates/repairs the profile name only. It never writes trial dates, changes existing dates, or backfills a new window. Existing trials therefore retain their original expiry.

`apps/web/lib/trial.ts` retains the 15-day constant and historical date utilities for compatibility; it is not an authorization to start a new trial. New runner products must have no store introductory trial configured.

## Web status

`ensureTrialStatus` in `apps/web/lib/trial-server.ts` now only reads the caller-owned profile. An absent profile or absent dates returns null fields; neither condition causes an insert, patch, or new trial. The auth/session and trial/status routes keep their existing contracts. `trial-server.test.ts` verifies both no-write behavior and preservation of an existing end date.

## Mobile status

`apps/mobile/lib/trial.ts` coalesces in-flight requests per user, first calls the web status endpoint with a bounded timeout, and falls back to a direct read of the same profile fields. The fallback does not upsert or repair dates. Duplicate auth events cannot restart a trial.

## Seen markers

The historical `trial_welcome_seen_at` and `trial_expired_seen_at` fields and acknowledgement helpers remain supported for older accounts. The root web layout does not mount a trial-welcome popup. Signup no longer advertises a new 15-day offer.

## Business invariants

- A launch announcement is informational only. It must not create, extend, acknowledge, or otherwise mutate a historical trial, premium grant, subscription, or entitlement; existing access ends under its recorded terms.

- Historical dates remain server-managed on `user_profiles` and are never deleted as a migration strategy.
- Missing dates mean no application trial, including for old profiles without a recorded start.
- Existing end timestamps, paid subscribers, and manual premium grants retain their own semantics.
- Apply the trigger migration with the read-only web/mobile rollout; old binaries cannot recreate protected dates through direct profile writes.

## Gotchas

- Do not restore client-side trial date repair or infer a new window from account creation time.
- Do not confuse a RevenueCat store grace period with the retired application trial.
- Existing valid trials still elevate global Premium until expiry; admin Free simulation overrides this only for its own session.
- This repository change prepares migrations; it does not prove they have been applied to a remote project.

## Related Docs

- [User Profiles Table](../02-database/tables/user-profiles.md)
- [Premium Entitlement](premium-entitlement.md)
- [Runner Monetization](runner-monetization.md)
- [Session Management](../04-auth-and-security/session-management.md)
