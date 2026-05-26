---
title: RLS Policies
scope: database
last_verified: 2026-05-26
ai_priority: high
related_files:
  - supabase/migrations
  - supabase/tests/coach_rls_checks.sql
  - apps/web/lib/supabase.ts
  - apps/web/lib/http.ts
related_tables:
  - race_plans
  - plan_aid_stations
  - races
  - race_aid_stations
  - products
  - user_profiles
  - subscriptions
  - premium_grants
---

# RLS Policies

## Purpose

This document describes the row-level security patterns used by Pace Yourself. Use it before adding policies, service routes, or SECURITY DEFINER functions.

## Key Concepts

- `auth.uid()`: Supabase user id for owner-scoped rows.
- `auth.role()`: role claim such as `anon`, `authenticated`, or `service_role`.
- `app_metadata`: trusted auth metadata for role checks.
- `user_metadata`: user-editable metadata; do not use for new authorization decisions.
- SECURITY DEFINER RPC: Postgres function that can safely perform privileged work when written with tight checks.

## Required Pattern

For user-owned rows, use `auth.uid()`:

```sql
create policy "Users can view their rows"
on public.some_table
for select
using (auth.uid() = user_id);
```

For admin checks in new policies, prefer:

```sql
(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
```

or a server-side/profile-based check that cannot be edited by the user.

Do not add new policies that rely on:

```sql
(auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
```

<!-- CONFLICT: older migrations still contain user_metadata admin checks, especially around premium grants and race image policies. Current guidance is to avoid that pattern for new policies and replace it during security-focused refactors. -->

## Policy Enumeration

### `race_plans`

Declared in `20241215010000_create_race_plans.sql` and coach migrations.

- Users can select own rows where `auth.uid() = user_id`.
- Users can insert own rows.
- Users can update own rows.
- Users can delete own rows.
- Coaches can select, insert, update, and delete coachee rows when an active `coach_coachees` relationship exists.
- Anonymous authenticated Supabase users are allowed through `auth.uid()` after `20260326000000_allow_anon_race_plans.sql` grants table privileges to `anon`.

### `plan_aid_stations`

Declared in `20251220120000_add_race_catalog.sql`.

- Users can select rows whose parent `race_plans.user_id = auth.uid()`.
- Users can insert rows for own parent plans.
- Users can update rows for own parent plans.
- Users can delete rows for own parent plans.

### `races`

Declared through old `race_catalog` policies and renamed/refined in `20260324000000_refactor_race_catalog_to_races.sql`.

- Public/live races are readable.
- Private races are readable by their creator.
- Admins can manage catalog races.
- Owners can manage private races through `created_by`.

Some policy branches include legacy admin metadata checks. Do not copy them into new migrations.

### `race_aid_stations`

Declared through old `race_catalog_aid_stations` policies and renamed in `20260324000000_refactor_race_catalog_to_races.sql`.

- Aid stations are readable when their race is public/live or the requesting user owns the race.
- Insert/update/delete are allowed for admins and race owners according to parent race access.

### `products`

Declared in `20241215030000_create_products_and_affiliate_offers.sql`, `20250902121500_allow_anon_read_products.sql`, and `20260322100000_add_created_by_to_products.sql`.

- Service role can manage products.
- Authenticated users can read live, non-archived products.
- Anon can read live, non-archived products.
- Users can read their own products through `created_by`.

`20260526120000_add_meltonic_products.sql` only inserts or updates shared live `products` rows with `created_by = null`; it does not change product policies or grants.

### `user_profiles`

Declared in `20250624103000_add_user_profiles.sql`.

- Users can select own profile.
- Users can insert own profile.
- Users can update own profile.

The auth trigger in `20260408100000_initialize_trial_profile_on_user_created.sql` uses SECURITY DEFINER to create/repair profile rows after auth user creation.

### `subscriptions`

Declared in `20250701100000_add_subscriptions_table.sql`.

- Service role can upsert/manage subscriptions.
- Users can select their own subscription row.

Web Stripe and RevenueCat server routes write with service role.

### `premium_grants`

Declared in `20260301090000_add_premium_grants.sql`.

- Service role or admins can manage grants.
- Users can read their own active grants.

<!-- CONFLICT: the manage policy includes app_metadata, user_profiles.role, user_metadata, and top-level role checks. New policies should not use user_metadata. -->

### Coach Tables

- `coach_tiers`: authenticated users can read.
- `coach_profiles`: service role manages; user reads own profile.
- `coach_coachees`: coaches and coachees can read relationships; service role inserts after repair migration.
- `coach_invites`: coaches read/write own invites; invited users can read by email claim or invitee id.
- `coach_intake_targets`: coach and coachee read; coach writes for active relationship.
- `coach_comments`: coaches manage comments for coachee plans; coachees read comments on their plans.

Manual checks live in `supabase/tests/coach_rls_checks.sql`.

### Push Tables

Declared in `20260504120000_add_push_notifications.sql`.

- `push_devices`: service role manages; users can select/insert/update/delete own devices.
- `push_notification_events`: service role manages; users can select own events.

### Other Tables

- `affiliate_offers`: service role manages; authenticated users read active offers attached to live products.
- `affiliate_click_events`: service role manages.
- `affiliate_events`: service role manages; authenticated users insert events for self or anonymous session.
- `app_feedback`: authenticated users can insert after later migration.
- `app_changelog`: authenticated users can view.
- `race_requests`: authenticated users can insert and read own requests.
- `nutrition_plans`: users can insert and view own rows.

## SECURITY DEFINER Use

Use SECURITY DEFINER when a function must do work the caller cannot safely do directly:

- reading or reacting to `auth.users`;
- atomically updating rate limit rows;
- validating cron secrets without exposing Vault values;
- computing analytics across auth/profile data.

Every SECURITY DEFINER function should set `search_path` explicitly when it touches user-controlled schemas.

## Correct and Incorrect Examples

Correct owner policy:

```sql
create policy "Users can update own profile"
on public.user_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

Correct admin check for new policies:

```sql
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
```

Incorrect new policy:

```sql
using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
```

## Gotchas

- `auth.users` is not a normal client-readable app table. Do not query it from client routes.
- Grants to `anon` do not bypass RLS; they allow anonymous Supabase users to reach the policy checks.
- Service role bypasses RLS. Only server code and Supabase functions may use it.
- Coach access is relationship-based. Do not grant coaches broad access by role alone.
- Additive shared product seed migrations do not need new RLS policies when they only upsert rows covered by the existing live-product read policies.

## Related Docs

- [RLS Checklist](../04-auth-and-security/rls-checklist.md)
- [Add RLS Policy](../06-workflows/add-rls-policy.md)
- [Schema Overview](schema-overview.md)
- [Premium Grants](tables/premium-grants.md)
