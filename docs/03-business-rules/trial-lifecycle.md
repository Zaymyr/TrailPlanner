---
title: Trial Lifecycle
scope: business-rule
last_verified: 2026-05-17
ai_priority: high
related_files:
  - apps/web/lib/trial.ts
  - apps/web/lib/trial-server.ts
  - apps/mobile/lib/trial.ts
  - supabase/migrations/20260408100000_initialize_trial_profile_on_user_created.sql
  - apps/web/app/api/auth/session/route.ts
related_tables:
  - user_profiles
---

# Trial Lifecycle

## Purpose

This document records how trial access starts, repairs itself, and expires. The current trial duration is 15 days.

## Key Concepts

- Trial start: `user_profiles.trial_started_at`.
- Trial end: `user_profiles.trial_ends_at`.
- Trial repair: filling missing trial fields for existing users.
- Seen markers: profile timestamps for welcome/expired notices.

## Duration

The current code and migration use:

```ts
TRIAL_DURATION_DAYS = 15
```

Sources:

- `apps/web/lib/trial.ts`
- `apps/mobile/lib/trial.ts`
- `supabase/migrations/20260408100000_initialize_trial_profile_on_user_created.sql`

<!-- CONFLICT: archived docs/app-rules-and-logic.md says the trial is 14 days. Current code and migration say 15 days. -->

## Creation

The migration `20260408100000_initialize_trial_profile_on_user_created.sql` creates `public.handle_new_user_profile()`:

- SECURITY DEFINER;
- `search_path = public`;
- runs after insert on `auth.users`;
- inserts or repairs `user_profiles`;
- sets `trial_started_at` to auth user creation time or current UTC time;
- sets `trial_ends_at` to start + 15 days.

## Web Repair

`apps/web/lib/trial-server.ts` exposes `ensureTrialStatus`.

It:

- reads `user_profiles` through the caller token;
- inserts a profile if missing;
- patches missing `trial_started_at`;
- patches missing `trial_ends_at`;
- computes missing end dates from the start plus 15 days.

`apps/web/app/api/auth/session/route.ts` calls `ensureTrialStatus` after validating the session.

## Mobile Repair

`apps/mobile/lib/trial.ts` uses the same 15-day duration. It:

- uses an in-flight map per user to prevent duplicate initialization;
- first tries the web `/api/trial/status` path;
- falls back to direct Supabase upsert/update when needed.

## Seen Markers

Profile timestamps:

- `trial_welcome_seen_at`
- `trial_expired_seen_at`

Web server helpers mark these timestamps when UI flows acknowledge the notices.

## Business Invariants

- Trial fields live on `user_profiles`.
- Trial initialization must be idempotent.
- Existing users with missing trial fields should be repaired, not blocked.
- Web and mobile duration must stay the same.

## Gotchas

- Auth event duplication can run session code more than once. Trial repair must remain idempotent.
- Do not start a new trial by deleting and recreating profile fields.
- Time comparisons should use actual timestamps, not local date strings.

## Related Docs

- [User Profiles Table](../02-database/tables/user-profiles.md)
- [Premium Entitlement](premium-entitlement.md)
- [Session Management](../04-auth-and-security/session-management.md)
- [Duplicate Events Pattern](../04-auth-and-security/duplicate-events-pattern.md)
