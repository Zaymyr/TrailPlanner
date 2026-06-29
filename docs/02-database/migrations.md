---
title: Migrations
scope: database
last_verified: 2026-06-29
ai_priority: high
related_files:
  - supabase/migrations
  - supabase/migrations/20260618160000_add_organizer_dashboard_details.sql
  - supabase/migrations/20260629123858_add_race_event_favorites_and_updates.sql
  - supabase/tests/organizer_rls_checks.sql
related_tables:
  - race_plans
  - plan_share_links
  - races
  - race_events
  - race_event_claims
  - race_event_organizers
  - race_event_updates
  - race_aid_station_products
  - products
  - user_favorite_race_events
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
- `supabase/migrations/20260525191426_add_official_product_metadata.sql`
- `supabase/migrations/20260526120000_add_meltonic_products.sql`
- `supabase/migrations/20260526135521_add_meltonic_product_images.sql`

`20260525191426_add_official_product_metadata.sql` adds:

- `products.is_official` as the explicit official/shared catalog flag;
- `products.official_name` to preserve the exact source label from brand imports;
- a one-time backfill/harmonization pass for the current official Baouw, Mulebar, Maurten, Aptonia, and Precision Fuel catalog rows.

`20260526120000_add_meltonic_products.sql` is a data-only shared product catalog migration. It inserts or updates a focused Meltonic trail/ultra effort selection using per-unit nutrition values, harmonized display names, `official_name`, and `is_official = true`. It does not add tables, columns, grants, or RLS policies.

`20260526135521_add_meltonic_product_images.sql` is a data-only follow-up for the Meltonic selection. It updates the official Meltonic rows with public `image_url` values from the corresponding brand product pages and does not change schema, grants, ownership, or RLS policies.

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

### Retired Coach System

Historical migrations added a coach/coachee feature, including `coach_tiers`, `coach_profiles`, `coach_coachees`, `coach_intake_targets`, `coach_invites`, `coach_comments`, coach status columns on `user_profiles`, `race_plans.coach_id`, and coach access policies for `race_plans`.

`supabase/migrations/20260618145940_remove_coach_features.sql` retires that surface by:

- dropping the `coach_*` tables and `coach_tiers`;
- dropping coach-specific columns from `race_plans` and `user_profiles`;
- dropping the coach `race_plans` policies;
- removing `coach_profiles` joins from `public.get_admin_user_rows()`.

Treat older coach migrations as history only. Do not build new schema or RLS behavior on those objects unless the feature is explicitly reintroduced.

### Premium and Trials

Important files:

- `supabase/migrations/20260201090000_add_trial_fields_to_user_profiles.sql`
- `supabase/migrations/20260215090000_add_trial_expired_seen_at_to_user_profiles.sql`
- `supabase/migrations/20260301090000_add_premium_grants.sql`
- `supabase/migrations/20260408100000_initialize_trial_profile_on_user_created.sql`

The auth trigger creates or repairs `user_profiles` with a 15-day trial.

Recent auth metrics migration:

- `supabase/migrations/20260525094919_add_sign_in_metrics_to_user_profiles.sql`
  - adds `user_profiles.sign_in_count`, `first_sign_in_at`, `last_sign_in_at`
  - adds `public.increment_user_sign_in(uuid, timestamptz)` SECURITY DEFINER function (service-role execution)

### Race Events and Catalog Enrichment

`supabase/migrations/20260331000000_add_thumbnail_to_race_events.sql` alters `race_events`, but no create-table migration for `race_events` was found.

<!-- TODO: verify with maintainer: identify the migration or dashboard history that creates race_events and columns used by current code. -->

### Organizer Portal

`supabase/migrations/20260528120000_add_organizer_portal.sql` adds the web organizer portal schema:

- `race_event_claims` for user-submitted event claims;
- `race_event_organizers` for approved event-scoped organizer memberships;
- `race_aid_station_products` for products offered at source race aid stations.

The migration deliberately does not use `races.created_by` for claimed public races. Organizer authorization is event-scoped through `race_event_organizers`, and admin RLS checks use `app_metadata`.

Manual relationship-policy checks live in `supabase/tests/organizer_rls_checks.sql`.

`supabase/migrations/20260618120000_add_race_aid_station_service_flags.sql` extends `race_aid_stations` with `solid_available` and `assistance_allowed`, both defaulting to `true`. It adds no new table, grants, foreign keys, or RLS policies; existing aid-station policies continue to control the rows.

`supabase/migrations/20260618160000_add_organizer_dashboard_details.sql` extends existing organizer source tables with nullable JSONB:

- `race_events.organizer_details`
- `races.organizer_details`
- `race_aid_stations.organizer_details`

It adds comments on the new columns and deliberately adds no grants, foreign keys, or RLS policies. Existing table row policies plus organizer service-route membership checks remain the access boundary.

`supabase/migrations/20260629123858_add_race_event_favorites_and_updates.sql` adds:

- `user_favorite_race_events` for runner-owned event favorites;
- `race_event_updates` for manual organizer announcements;
- owner RLS for favorites;
- live-event read RLS plus organizer/admin insert RLS for updates.

The manual RLS SQL check file was expanded accordingly so organizer relationship checks now also cover event favorites and update visibility behavior.

### Plan Recap Sharing

`supabase/migrations/20260609091933_add_plan_share_links.sql` adds `plan_share_links` for public crew recap links generated from mobile saved plans.

The migration:

- stores only a SHA-256 `token_hash`, never the raw public URL token;
- stores a bounded `snapshot` JSONB payload with `snapshot_schema_version = 1`;
- references `race_plans(id)` with cascade delete and `auth.users(id)` for ownership;
- enables RLS with owner policies and parent `race_plans.user_id = auth.uid()` checks;
- grants direct table privileges to `authenticated`, not `anon`, because public reads go through the Next.js server page.

`supabase/migrations/20260609143056_add_plan_share_crew_state.sql` adds `plan_share_links.crew_state` as a bounded JSONB payload for public crew-side tracking. It does not add anon grants or new policies because reads and writes still resolve the secret token through Next.js service-role routes.

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
- The organizer portal migration references `race_events`; its create-table migration is still not visible here, so verify live schema before changing event-level DDL.
- Adding columns to an existing exposed table can reuse the table's RLS policies, but route code must still map legacy missing values safely.
- Organizer dashboard JSONB columns are nullable progressive metadata. Keep public/mobile queries explicit when they should not expose organizer draft details.
- Event-favorite and organizer-update migrations are intentionally event-scoped on `race_events`; do not move them to `races` without revisiting mobile catalog pinning and notification contracts.
- Do not use ownership columns such as `created_by` as a proxy for catalog state when a dedicated metadata field exists. `products.is_official` is the source of truth for official/shared catalog rows.
- Data-only brand imports created after official product metadata should populate `official_name` and `is_official` in the same migration.
- Product image backfills for official catalog rows should update `products.image_url` without changing ownership or visibility semantics.
- Public link migrations should not store raw share tokens. Hash tokens server-side and keep public reads behind a service-role route/page that validates expiry and revocation.
- Public crew tracking state belongs beside the share snapshot, not in the private plan JSON. Keep it bounded and route-mediated.

## Related Docs

- [Schema Overview](schema-overview.md)
- [RLS Policies](rls-policies.md)
- [Add New Table](../06-workflows/add-new-table.md)
- [Add RLS Policy](../06-workflows/add-rls-policy.md)
- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
