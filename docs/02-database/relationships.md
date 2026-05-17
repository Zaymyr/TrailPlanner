---
title: Database Relationships
scope: database
last_verified: 2026-05-17
ai_priority: high
related_files:
  - supabase/migrations/20241215010000_create_race_plans.sql
  - supabase/migrations/20251220120000_add_race_catalog.sql
  - supabase/migrations/20260324000000_refactor_race_catalog_to_races.sql
  - supabase/migrations/20260408110000_set_race_plans_race_fk_on_delete_set_null.sql
  - supabase/migrations/20250624103000_add_user_profiles.sql
  - supabase/migrations/20250701100000_add_subscriptions_table.sql
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

# Database Relationships

## Purpose

This document describes the important foreign keys and ownership relationships in the Supabase schema. Use it before changing cascade behavior, delete flows, or RLS policies.

## Key Concepts

- Ownership FK: a row references a user's profile or auth user id.
- Catalog FK: a saved plan references the source race it was imported from.
- Snapshot row: data copied into plan-specific tables so the plan can diverge from catalog source.
- Orphan-on-delete: deleting a race should not delete saved plans.

## User Ownership

`user_profiles.user_id` is the app profile primary key and defaults to `auth.uid()`.

User-owned tables include:

- `race_plans.user_id`
- `products.created_by`
- `premium_grants.user_id`
- `subscriptions.user_id`
- `push_devices.user_id`
- `push_notification_events.user_id`
- `nutrition_plans.user_id`
- `race_requests.user_id`
- `user_favorite_products.user_id`

`subscriptions.user_id` and `premium_grants.user_id` reference `auth.users(id)` directly. Client code must not query `auth.users`; use service routes or SECURITY DEFINER functions when auth-user data is needed.

## Race and Plan Relationships

`races` was renamed from `race_catalog` in `supabase/migrations/20260324000000_refactor_race_catalog_to_races.sql`.

Important relationships:

- `race_aid_stations.race_id` references `races(id)` with cascade delete from the original catalog aid station table.
- `race_plans.race_id` references `races(id)` with `on delete set null` after `supabase/migrations/20260408110000_set_race_plans_race_fk_on_delete_set_null.sql`.
- `plan_aid_stations.plan_id` references `race_plans(id)` with cascade delete.

The design is:

1. A catalog/private race owns source aid stations.
2. A saved plan stores a race link plus plan-specific aid station snapshots.
3. Deleting a race detaches plans by setting `race_plans.race_id = null`, rather than deleting user plans.

## Product Relationships

`products` has:

- `created_by uuid references auth.users(id) on delete set null`
- `affiliate_offers.product_id references products(id) on delete cascade`
- `user_favorite_products.product_id references products(id) on delete cascade`

User-created products can remain if the user is deleted because `created_by` is nullable with `on delete set null`.

## Coach Relationships

Coach relationships are centered on `user_profiles`:

- `coach_coachees.coach_id -> user_profiles(user_id)`
- `coach_coachees.coachee_id -> user_profiles(user_id)`
- `coach_intake_targets.coach_id -> user_profiles(user_id)`
- `coach_intake_targets.coachee_id -> user_profiles(user_id)`
- `coach_comments.coach_id -> user_profiles(user_id)`
- `coach_comments.coachee_id -> user_profiles(user_id)`
- `coach_comments.plan_id -> race_plans(id)`
- `coach_profiles.user_id -> user_profiles(user_id)`
- `coach_profiles.coach_tier_id -> coach_tiers(id)`
- `user_profiles.coach_tier_id -> coach_tiers(id)`

RLS checks require an active coach relationship for coachee plan access.

## Subscription Relationships

`subscriptions` is keyed by `user_id`. It stores both:

- web Stripe rows with provider `web`;
- mobile RevenueCat rows with provider `google` or `apple`.

`coach_profiles` also stores Stripe customer/subscription IDs for coach-tier plans. Stripe webhooks update both `subscriptions` and `coach_profiles`.

## Race Events Relationship

Current code treats `race_events` as a parent/grouping table for `races`:

- `apps/web/app/api/race-catalog/route.ts` creates `race_events`.
- admin APIs query `races(..., race_events(...))`.
- mobile catalog groups races by `race_events`.

<!-- TODO: verify with maintainer: visible migrations only show supabase/migrations/20260331000000_add_thumbnail_to_race_events.sql altering race_events.thumbnail_url; no create-table migration for race_events was found in this repo. -->

## Gotchas

- Do not restore `race_catalog` names from archived docs. Current code uses `races`.
- Deleting a race should preserve saved plans. Use `race_id = null`, not cascade deletion.
- Coach access must be relationship-based, not just `coach_id` field matching.
- `plan_aid_stations.race_aid_station_id` is referenced by `GpxAidStationImporter`, but no visible migration creates it.

## Related Docs

- [Schema Overview](schema-overview.md)
- [RLS Policies](rls-policies.md)
- [race_plans](tables/race-plans.md)
- [plan_aid_stations](tables/plan-aid-stations.md)
- [race_aid_stations](tables/race-aid-stations.md)
