---
title: user_profiles Table
scope: database
last_verified: 2026-06-18
ai_priority: high
related_files:
  - supabase/migrations/20250624103000_add_user_profiles.sql
  - supabase/migrations/20260201090000_add_trial_fields_to_user_profiles.sql
  - supabase/migrations/20260408100000_initialize_trial_profile_on_user_created.sql
  - supabase/migrations/20260414160000_add_plan_defaults_to_user_profiles.sql
  - supabase/migrations/20260414173000_add_body_metrics_to_user_profiles.sql
  - supabase/migrations/20260525094919_add_sign_in_metrics_to_user_profiles.sql
  - supabase/migrations/20260618145940_remove_coach_features.sql
  - apps/web/lib/trial-server.ts
  - apps/web/lib/entitlements.ts
related_tables:
  - user_profiles
---

# `user_profiles`

## Purpose

`user_profiles` stores app-level profile data for each Supabase auth user. It is also the durable source for trial dates, default nutrition targets, sign-in metrics, and athlete metrics.

## Key Concepts

- Profile row: app-owned companion to `auth.users`.
- Trial fields: 15-day premium trial lifecycle state.
- Defaults: user-level planner target defaults.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `user_id` | `uuid` | primary key, default `auth.uid()` | Auth user/profile id. |
| `created_at` | `timestamptz` | not null, default UTC `now()` | Creation time. |
| `updated_at` | `timestamptz` | not null, trigger-maintained | Last update time. |
| `full_name` | `text` | nullable | User display name. |
| `role` | `text` | nullable | Legacy/profile role used in some admin checks. |
| `age` | `integer` | nullable, check `age >= 0` | Legacy age field. |
| `birth_date` | date-like | nullable | Birth date added after age. |
| `water_bag_liters` | `numeric` | nullable, check `>= 0` | Water carrying capacity. |
| `utmb_index` | `numeric` | nullable, check `0..2000` | UTMB index. |
| `comfortable_flat_pace_min_per_km` | `numeric` | nullable, check positive | User comfort pace. |
| `trial_started_at` | `timestamptz` | nullable | Trial start time. |
| `trial_ends_at` | `timestamptz` | nullable | Trial end time. |
| `trial_welcome_seen_at` | `timestamptz` | nullable | Welcome modal/banner acknowledgement. |
| `trial_expired_seen_at` | `timestamptz` | nullable | Expired notice acknowledgement. |
| `default_carbs_g_per_hour` | `numeric` | nullable | Default carb target. |
| `default_water_ml_per_hour` | `numeric` | nullable | Default water target. |
| `default_sodium_mg_per_hour` | `numeric` | nullable | Default sodium target. |
| `weight_kg` | `numeric` | nullable | Athlete body weight. |
| `height_cm` | `numeric` | nullable | Athlete height. |
| `sign_in_count` | `integer` | not null, default `0` | Number of successful app sign-ins recorded by server routes. |
| `first_sign_in_at` | `timestamptz` | nullable | Timestamp of first recorded sign-in. |
| `last_sign_in_at` | `timestamptz` | nullable | Timestamp of latest recorded sign-in. |

## Foreign Keys

No profile-specific foreign keys are documented in the active schema. `user_profiles.user_id` is treated as the app profile key for the matching Supabase auth user.

## Indexes

The base migration creates profile primary key and related favorite product indexes. Later profile-specific indexes were not found for the fields above.

## RLS Policies

See [../rls-policies.md](../rls-policies.md).

Summary:

- Users can select, insert, and update their own profile.
- Service-role routes and SECURITY DEFINER auth trigger can create/repair rows.

## Business Invariants

- Trial duration is 15 days. The trigger and `apps/web/lib/trial.ts` agree on this value.
- `handle_new_user_profile` runs after auth user creation and uses SECURITY DEFINER to insert or repair trial fields.
- `ensureTrialStatus` repairs missing profile/trial fields on session verification.
- Sign-in metrics are updated by `public.increment_user_sign_in(...)`, called from server auth sign-in flow.

<!-- CONFLICT: archived docs/app-rules-and-logic.md says trial duration is 14 days; current code and migration use 15 days. -->

## Common Queries

Fetch a user's trial state:

```sql
select user_id, trial_started_at, trial_ends_at, trial_welcome_seen_at, trial_expired_seen_at
from public.user_profiles
where user_id = auth.uid();
```

Fetch sign-in metrics:

```sql
select user_id, sign_in_count, first_sign_in_at, last_sign_in_at
from public.user_profiles
where user_id = '<user-id>';
```

## Gotchas

- Do not read `auth.users` from client code to get profile fields.
- Use `birth_date` for new age-related work unless maintaining legacy `age`.
- Trial fields can be missing for older users; server code repairs them.
- Profile `role` exists, but new auth decisions should prefer trusted `app_metadata` or server-side checks.
- Sign-in metrics are best-effort and currently incremented on credential sign-in route; include this caveat in admin analytics interpretation.

## Related Docs

- [Trial Lifecycle](../../03-business-rules/trial-lifecycle.md)
- [Premium Entitlement](../../03-business-rules/premium-entitlement.md)
- [Auth Flows](../../04-auth-and-security/auth-flows.md)
- [RLS Policies](../rls-policies.md)
