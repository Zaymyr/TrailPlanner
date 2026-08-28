---
title: Migrations
scope: database
last_verified: 2026-08-28
ai_priority: high
related_files:
  - supabase/migrations
  - supabase/migrations/20260618160000_add_organizer_dashboard_details.sql
  - supabase/migrations/20260629123858_add_race_event_favorites_and_updates.sql
  - supabase/migrations/20260820130930_add_format_targeted_race_updates.sql
  - supabase/migrations/20260720120000_add_race_edition_groups.sql
  - supabase/migrations/20260721110000_add_race_event_edition_requests.sql
  - supabase/migrations/20260804152041_add_race_event_editions.sql
  - supabase/migrations/20260729110000_add_race_event_publication_requests.sql
  - supabase/migrations/20260820135823_add_racebook_publication_control.sql
  - supabase/migrations/20260820164141_target_racebook_publication_requests.sql
  - supabase/migrations/20260821143417_add_organizer_imports_bucket.sql
  - supabase/migrations/20260824114439_add_organizer_import_sessions_and_drafts.sql
  - supabase/migrations/20260824152859_add_relay_course_points.sql
  - supabase/migrations/20260824164101_manage_organizer_edition_visibility_and_deletion.sql
  - supabase/migrations/20260824170652_restrict_delete_race_event_edition_rpc.sql
  - supabase/migrations/20260826090000_allow_event_level_publication_requests.sql
  - supabase/migrations/20260827093348_seed_trail_tst_demo_event.sql
  - supabase/migrations/20260827134209_remove_tst_82_course_constraint_notes.sql
  - supabase/migrations/20260828161008_add_race_slug_redirects.sql
  - supabase/migrations/20260804143259_add_onboarding_completion_to_user_profiles.sql
  - supabase/tests/organizer_rls_checks.sql
  - supabase/tests/organizer_import_sessions_checks.sql
  - supabase/tests/race_slug_redirects_checks.sql
related_tables:
  - race_plans
  - plan_share_links
  - races
  - race_slug_redirects
  - race_relay_points
  - organizer_import_sessions
  - race_events
  - race_event_claims
  - race_event_organizers
  - race_event_publication_requests
  - race_event_updates
  - race_event_update_reads
  - race_event_editions
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

Mobile onboarding completion migration:

- `supabase/migrations/20260804143259_add_onboarding_completion_to_user_profiles.sql`
  - adds nullable `user_profiles.onboarding_completed_at`;
  - reuses existing owner select/insert/update policies and grants;
  - leaves legacy rows null so the mobile gate can continue its durable-data fallback.

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

`supabase/migrations/20260824152859_add_relay_course_points.sql` adds nullable `races.participation_mode` plus normalized `race_relay_points`. A handover may link to a ravito with `on delete set null`; public reads require a published Racebook and mutations remain service-role-only.

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

`supabase/migrations/20260820130930_add_format_targeted_race_updates.sql` adds nullable `race_event_updates.race_id`, validates event/format consistency in the organizer insert policy, and creates owner-scoped `race_event_update_reads`. The receipt table grants only authenticated select/insert access, requires `auth.uid() = user_id`, and permits inserts only for updates under live events.

`supabase/migrations/20260720120000_add_race_edition_groups.sql` originally added `races.edition_group_id` and `races.series_name` to group yearly rows of one format. The later canonical edition table does not replace that cross-year series grouping.

`supabase/migrations/20260721110000_add_race_event_edition_requests.sql` introduced the former yearly-edition review queue. `20260729110000_add_race_event_publication_requests.sql` retires new edition requests, closes pending legacy rows, and introduces the event publication-review table plus atomic service-role review function.

`supabase/migrations/20260804152041_add_race_event_editions.sql` normalizes yearly event dates into `race_event_editions`, backfills rows from existing event/format dates, attaches formats through `races.edition_id`, restricts the table to service-role routes, and keeps legacy `race_events` date fields synchronized from the current edition. It also scopes publication approval to the current edition.

`supabase/migrations/20260824164101_manage_organizer_edition_visibility_and_deletion.sql` adds default-visible `race_event_editions.is_visible`, database triggers that force every format and Racebook hidden with its edition, and cascade deletion from an edition to its formats. Its service-role-only invoker-security deletion RPC rejects the last edition, atomically selects a replacement current edition, and leaves saved plans detached through their existing race foreign key.

`supabase/migrations/20260824170652_restrict_delete_race_event_edition_rpc.sql` repairs project-level default function grants by explicitly revoking execution on the new edition trigger functions and deletion RPC from `anon` and `authenticated`, while retaining service-role execution only for the deletion RPC.

`supabase/migrations/20260820135823_add_racebook_publication_control.sql` separates course catalog visibility from Racebook publication. It adds `races.racebook_is_live` plus durable admin approval provenance, replaces the publication-review function, and adds the service-role-only admin event switch function. As a safety migration it keeps organizer-managed courses live in the catalog but resets their Racebooks to hidden/unapproved for one fresh admin validation pass.

`supabase/migrations/20260820164141_target_racebook_publication_requests.sql` adds nullable legacy-compatible `race_id` targeting to publication requests, changes pending uniqueness from event scope to format scope, binds organizer inserts to a race under the same managed event, and makes first approval publish only that requested format and its own edition. The admin event-wide switch remains current-edition scoped and closes only matching pending requests.

`supabase/migrations/20260821143417_add_organizer_imports_bucket.sql` adds the private `organizer-imports` bucket with a 25 MB PDF/JPEG/PNG/WebP limit. Authenticated users may insert and delete only objects whose first path segment matches their own auth user id. The organizer website-import route uses service-role access to read and delete these temporary objects after analysis; no document is persisted as race-event data.

`supabase/migrations/20260826090000_allow_event_level_publication_requests.sql` reverts the organizer insert policy so `race_id` may be null again, restoring one event-level publication request per event/current-edition. `review_race_event_publication_request` already supported this null-`race_id` branch (added in `20260820164141_target_racebook_publication_requests.sql`) by approving every complete format of the current edition at once, so no function changes were needed.

`supabase/migrations/20260824114439_add_organizer_import_sessions_and_drafts.sql` implements the database boundary for two-pass Organizer imports:

- adds `races.data_status` and `missing_required_fields`, defaulting existing rows to complete;
- enforces hidden incomplete drafts and explicit zero/null sentinels for required unknowns;
- creates service-only `organizer_import_sessions` with a two-hour default expiry and event/edition scope validation;
- adds invoker-security, service-role-only RPCs for atomic format confirmation and allowlisted field application, including optional explicit aid-station replacement;
- configures an hourly Vault-authenticated pg_cron GET to the web cleanup route when `web_app_url` and `cron_secret` exist.

The companion `supabase/tests/organizer_import_sessions_checks.sql` checks privileges, RLS, strict payload rejection, draft creation, explicit station replacement, and the draft-to-live-course transition.

### Racebook Showcase Data

`supabase/migrations/20260827093348_seed_trail_tst_demo_event.sql` is a data-only, idempotent showcase seed. It publishes the fictional `Trail TST` 2026 event with three complete formats (18 km, 42 km, and an 82 km solo/relay format), organizer JSONB details, ordered ravitos, official product links, and two relay handover points. The referenced cover and GPX objects live under `race-images/trail-tst/2026/` and `race-gpx/trail-tst/2026/`; repository copies live under `supabase/demo-assets/` so the fixture remains reproducible. It changes no table, grant, function, trigger, or RLS policy.

`supabase/migrations/20260827134209_remove_tst_82_course_constraint_notes.sql` removes the two fictional free-text schedule constraint notes from the TST 82 showcase format. It preserves the representative start time, finish cutoff, ravitos, and per-station cutoff times, and changes no schema or access policy.

### Public Course Slug Redirects

`supabase/migrations/20260828161008_add_race_slug_redirects.sql` adds the durable `race_slug_redirects` mapping, a parent-visibility-gated public select policy, and explicit Data API grants. Its invoker-security trigger reserves every former slug during a race rename and rejects reuse on insert/update; the service-role-only `rename_race_slug(uuid, text)` RPC performs reviewed renames atomically.

`supabase/tests/race_slug_redirects_checks.sql` is the rollback-only manual verification for grants, RLS, invoker security, repeated renames, anon visibility, hidden targets, and reserved-slug rejection. This change does not apply the migration or rename catalog rows automatically.

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

Organizer import cleanup additionally uses `organizer-import-cleanup-hourly` at minute 17 of each hour. Unlike data-only purges, it calls `/api/cron/organizer-import-cleanup` so the route can remove private Storage objects before deleting expired session rows.

## Adding a Migration

1. Read the relevant table doc under `docs/02-database/tables`.
2. Read current migrations that last touched the table.
3. Run `npx supabase migration new <descriptive-name>` to create the timestamped SQL file; do not invent the filename manually.
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
- `races.edition_group_id` groups a format series across years; `races.edition_id` identifies the canonical event-year row. Do not substitute one for the other.
- `race_event_editions` is service-role-only. Organizer writes must remain behind active membership checks in server routes.
- Edition deletion must go through `delete_race_event_edition`; direct row deletion would lose the last-edition guard and replacement-current selection even though the format cascade would still apply.
- Keep first Racebook approval in `race_event_publication_requests`; do not restore edition-review inserts or organizer writes to catalog `is_live`. Approved organizers may write only `racebook_is_live`.
- Organizer dashboard JSONB columns are nullable progressive metadata. Keep public/mobile queries explicit when they should not expose organizer draft details.
- Event-favorite and organizer-update migrations are intentionally event-scoped on `race_events`; do not move them to `races` without revisiting mobile catalog pinning and notification contracts.
- Do not use ownership columns such as `created_by` as a proxy for catalog state when a dedicated metadata field exists. `products.is_official` is the source of truth for official/shared catalog rows.
- Data-only brand imports created after official product metadata should populate `official_name` and `is_official` in the same migration.
- Product image backfills for official catalog rows should update `products.image_url` without changing ownership or visibility semantics.
- Public link migrations should not store raw share tokens. Hash tokens server-side and keep public reads behind a service-role route/page that validates expiry and revocation.
- Public crew tracking state belongs beside the share snapshot, not in the private plan JSON. Keep it bounded and route-mediated.
- Column-only onboarding markers on `user_profiles` must keep owner-scoped writes and must not use a fabricated profile preference as a completion signal.
- Temporary organizer roadbooks belong only in `organizer-imports`, never in `race-gpx` or public image buckets. Keep owner-folder checks on browser upload/delete policies and service-route cleanup in a `finally` block.
- Do not replace the Organizer cleanup HTTP job with a direct SQL row purge: deleting the manifest first can orphan temporary Storage objects.
- Keep the `Trail TST` seed ids and Storage paths stable. Re-running the migration updates the showcase rows in place; changing ids or paths would create duplicate catalog entries or broken map/profile assets.
- Never deploy course-slug edits before the redirect migration. Review the GET-only slug audit first, then use the service-only RPC for approved rows so the old URL and canonical target change in one transaction.

## Related Docs

- [Schema Overview](schema-overview.md)
- [RLS Policies](rls-policies.md)
- [Add New Table](../06-workflows/add-new-table.md)
- [Add RLS Policy](../06-workflows/add-rls-policy.md)
- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
- [Race Slug Redirects](tables/race-slug-redirects.md)
