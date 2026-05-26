---
title: Migrations
scope: database
last_verified: 2026-05-26
ai_priority: high
related_files:
  - supabase/migrations
  - supabase/tests/coach_rls_checks.sql
related_tables:
  - race_plans
  - races
  - products
  - user_profiles
  - subscriptions
  - premium_grants
---

# Migrations

## Purpose

This document summarizes the migration history and the rules for adding new Supabase migrations. Use it to understand current schema provenance and avoid reviving archived schema names.

## Key Concepts

- Migration source of truth: files under `supabase/migrations`.
- Archived schema: historical SQL reference under `docs/_archive/db/schema.sql`.
- Refactor migration: a migration that renames or replaces earlier objects.
- Repair migration: a later migration that fixes policy, cron, or schema behavior.

## Migration Phases

### Initial App Tables

Early migrations create:

- `app_feedback`
- `race_plans`
- `products`
- `affiliate_offers`
- `affiliate_click_events`
- `affiliate_events`

Important files:

- `supabase/migrations/20241215000000_create_app_feedback.sql`
- `supabase/migrations/20241215010000_create_race_plans.sql`
- `supabase/migrations/20241215030000_create_products_and_affiliate_offers.sql`
- `supabase/migrations/20241215040000_create_affiliate_click_events.sql`
- `supabase/migrations/20241215050000_create_affiliate_events.sql`

### Profile, Subscription, Product Expansion

These migrations add profile and billing support:

- `supabase/migrations/20250624103000_add_user_profiles.sql`
- `supabase/migrations/20250701100000_add_subscriptions_table.sql`
- `supabase/migrations/20250902121500_allow_anon_read_products.sql`
- `supabase/migrations/20250214120000_add_product_url_to_products.sql`
- `supabase/migrations/20260526120000_add_meltonic_products.sql`

`20260526120000_add_meltonic_products.sql` is a data-only shared product catalog migration. It inserts or updates a focused Meltonic trail/ultra effort selection using per-unit nutrition values and does not add tables, columns, grants, or RLS policies.

### Trace Era Removed

`supabase/migrations/20251219141801_add_traces.sql` adds trace-era tables, but `supabase/migrations/20250614120000_remove_traces.sql` removes/disables them. Treat `traces`, `trace_points`, and `aid_stations` as legacy unless a maintainer says otherwise.

### Race Catalog to Races

`supabase/migrations/20251220120000_add_race_catalog.sql` creates:

- `race_catalog`
- `race_catalog_aid_stations`
- `plan_aid_stations`
- catalog fields on `race_plans`

`supabase/migrations/20260324000000_refactor_race_catalog_to_races.sql` renames:

- `race_catalog` to `races`
- `race_catalog_aid_stations` to `race_aid_stations`
- `race_plans.catalog_race_id` to `race_id`

It also adds `races.created_by` and `races.is_public`.

### Coach System

Coach migrations add:

- `coach_tiers`
- coach status fields on `user_profiles`
- `coach_coachees`
- `coach_intake_targets`
- `coach_invites`
- `coach_profiles`
- `coach_comments`
- coach access policies for `race_plans`

Important repair migrations:

- `supabase/migrations/20260220193000_require_active_coach_relationship_for_race_plans.sql`
- `supabase/migrations/20260220210000_allow_coach_access_to_all_coachee_plans.sql`
- `supabase/migrations/20260304130000_fix_coach_coachees_rls.sql`

### Premium and Trials

Important files:

- `supabase/migrations/20260201090000_add_trial_fields_to_user_profiles.sql`
- `supabase/migrations/20260215090000_add_trial_expired_seen_at_to_user_profiles.sql`
- `supabase/migrations/20260301090000_add_premium_grants.sql`
- `supabase/migrations/20260408100000_initialize_trial_profile_on_user_created.sql`

The auth trigger creates or repairs `user_profiles` with a 15-day trial.

### Race Events and Catalog Enrichment

`supabase/migrations/20260331000000_add_thumbnail_to_race_events.sql` alters `race_events`, but no create-table migration for `race_events` was found.

<!-- TODO: verify with maintainer: identify the migration or dashboard history that creates race_events and columns used by current code. -->

### Push Notifications and Cron

Push support comes from:

- `supabase/migrations/20260504120000_add_push_notifications.sql`
- `supabase/migrations/20260504133000_schedule_push_reminders_with_supabase_cron.sql`
- `supabase/migrations/20260504094253_fix_push_reminders_cron_auth.sql`

The later cron auth migration should be treated as the effective schedule/auth implementation.

## Adding a Migration

1. Read the relevant table doc under `docs/02-database/tables`.
2. Read current migrations that last touched the table.
3. Create a timestamped SQL file in `supabase/migrations`.
4. Write idempotent DDL where possible with `if exists` / `if not exists`.
5. Add or update RLS in the same migration when adding a user-facing table.
6. Add comments or tests for SECURITY DEFINER functions.
7. Update this docs tree in the same PR/branch.

## Gotchas

- Do not copy old `race_catalog` DDL from `docs/_archive/db/schema.sql`.
- Do not add `user_metadata` admin checks in new policies.
- If a migration references `auth.users`, prefer a SECURITY DEFINER function or server/service-role route for reads.
- When a route already expects a column not visible in migrations, add a conflict marker in docs and verify live schema before migration work.
- Product catalog data migrations should not archive the shared catalog unless the task is explicitly replacing the catalog; additive brand imports should only upsert their own slugs.

## Related Docs

- [Schema Overview](schema-overview.md)
- [RLS Policies](rls-policies.md)
- [Add New Table](../06-workflows/add-new-table.md)
- [Add RLS Policy](../06-workflows/add-rls-policy.md)
