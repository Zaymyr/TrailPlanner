# Data model (business-critical tables)

Built from `supabase/migrations/` (schema truth) on 2026-11-20. This is a map, not a full schema: each table links to its detailed doc in [docs/02-database/tables/](../02-database/tables/). Full table list: [schema-overview.md](../02-database/schema-overview.md). RLS details: [rls-policies.md](../02-database/rls-policies.md).

No generated Supabase types file (`Database` type) exists in the repo; code uses hand-written Zod schemas and types.

## Admin & RLS baseline

- Admin = `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'` (or `'admin'` in `app_metadata.roles`), see `20260914055319_harden_privileged_database_access.sql`. `user_profiles.role` exists but is protected from client writes and is **not** an authorization source.
- Owner tables use `user_id = auth.uid()`. Anonymous Supabase users (anon sign-in) can own `race_plans` (`20260326000000_allow_anon_race_plans.sql`).
- Many organizer/billing tables are service-role only; clients go through Next.js API routes or SECURITY DEFINER RPCs.

## Catalog: race_events → race_event_editions → races

### race_events — [doc](../02-database/tables/race-events.md)
- Purpose: event identity (name, location, image, live state) grouping yearly editions and formats.
- Key columns: `id`, `name`, `slug` (durable year-free hub slug, not null, unique, immutable, never equal to an edition slug — `20261122230000`), `location`, `thumbnail_url`, `short_name`, `website_url`, `organizer_details` (JSONB), normalized geography `location_city…location_country_code` (French `location_region_code` = INSEE code, backfilled from the region name by `20261122230000`; region landing pages trust only the code), `location_latitude/longitude`.
- **The create-table migration is not in the repo**; only later `add column` migrations are. Verify against live schema before depending on base columns.

### race_event_editions — [doc](../02-database/tables/race-event-editions.md)
- Purpose: one row per event year; canonical dates and edition-level visibility.
- Key columns: `event_id` → `race_events` (cascade), `edition_year`, `start_date`, `end_date`, `is_current`, `is_visible`, `slug` (edition page, canonicalized to the event hub; former slugs in `race_event_edition_slug_redirects`), `module_setup_completed_at`. Unique `(event_id, edition_year)`.
- RLS: service-role only (public reads traverse `races`, not this table).

### races — [doc](../02-database/tables/races.md)
- Purpose: one course format (e.g. 42 km) of an edition. Renamed from `race_catalog` (`20260324000000`).
- Key columns: `slug`, `name`, `distance_km`, `elevation_gain_m`, `location_text`, `event_id` (not created in visible migrations), `edition_id` → `race_event_editions` (set null), `is_live`, `is_public`, `racebook_is_live`, `racebook_preview_is_visible`, `web_catalog_is_live`, `data_status`, `missing_required_fields`, `participation_mode`, `organizer_details`, GPX columns `gpx_path`, `gpx_hash`, `gpx_storage_path`, `gpx_sha256`, bounds/altitude stats, `plan_source_updated_at`.
- RLS: `races_select` exposes live/public rows; inserts closed to runners since `20260930104930`; admin and organizer writes go through service routes.

### race_aid_stations — [doc](../02-database/tables/race-aid-stations.md)
- Purpose: source aid stations of a format. Renamed from `race_catalog_aid_stations`.
- Key columns: `race_id` → `races` (cascade), `name`, `km`, `order_index`, `water_available`, `solid_available`, `assistance_allowed`, `notes`, `organizer_details` (JSONB).
- Related: `race_aid_station_products` (organizer-declared products per station), `race_relay_points`, `race_supporter_points`.

## Runner plans

### race_plans — [doc](../02-database/tables/race-plans.md)
- Purpose: a runner's saved plan.
- Key columns: `user_id` (default `auth.uid()`), `name`, `planner_values` (JSONB, the whole planner state incl. per-station products), `elevation_profile` (JSONB), `race_id` → `races` (renamed from `catalog_race_id`, on delete set null), `catalog_race_updated_at_at_import`, `plan_gpx_path`, `plan_course_stats`, `source_revision_at_last_review`.
- Constraint: at most one plan per `(user_id, race_id)` when `race_id` is not null (`20261029090122`).
- A trigger strips paid fields from `planner_values` (segments, supplies, finish plan…) when the user has no unlock/premium (`20261030121252`).
- RLS: owner only (incl. anonymous users).

### plan_aid_stations — [doc](../02-database/tables/plan-aid-stations.md)
- Purpose: per-plan aid station snapshot.
- Key columns: `plan_id` → `race_plans` (cascade), `name`, `km`, `water_available`, `notes`, `order_index`. No product columns.

Sharing: `plan_share_links`, `plan_share_follows` — see their docs.

## Products — [doc](../02-database/tables/products.md)
- Purpose: nutrition product catalog plus user-created products.
- Key columns: `slug`, `sku`, `name`, `brand`, `official_name`, `is_official`, `fuel_type`, `calories_kcal`, `carbs_g`, `protein_g`, `fat_g`, `sodium_mg`, `product_url`, `image_url`, `created_by`, `is_live`, `is_archived`.
- RLS: anon and authenticated read `is_live = true and is_archived = false`; creators also read their own rows.

## User profiles — [doc](../02-database/tables/user-profiles.md)
- Purpose: app profile, one row per user (`user_id` PK).
- Key columns: `full_name`, `birth_date`, `water_bag_liters`, `weight_kg`, `height_cm`, `utmb_index`, `comfortable_flat_pace_min_per_km`, `default_carbs_g_per_hour`, `default_water_ml_per_hour`, `default_sodium_mg_per_hour`, trial fields, sign-in metrics, `plan_/racebook_/supporter_onboarding_status`, `role` (not authoritative).
- RLS: owner; role/trial/sign-in fields cannot be mutated by the client.

## Purchases & entitlements (runners) — [runner billing doc](../02-database/tables/runner-billing.md)

| Table | Purpose | Client access |
| --- | --- | --- |
| `runner_plan_unlocks` | One-off unlock per canonical `plan_key` (format + edition), `provider` stripe/google/apple/admin, `status` pending/active/refunded/revoked; charge paid `amount_minor` (TTC, minor units) + `currency` + store `store_takehome_rate` / `store_tax_rate` (nullable, since 2026-11-23) | owner read |
| `runner_purchase_intents` | Server-created pending purchase | owner read |
| `runner_billing_events` | Deduplicated provider webhook ledger; each charging event keeps `amount_minor`, `currency`, store rates | service |
| `runner_subscription_accounts` | Provider subscription ledger; latest charged period `last_amount_minor`, `last_currency`, `last_charged_at`, `last_store_takehome_rate`, `last_store_tax_rate` | service |
| `runner_monetization_config` | Single-row `monetization_enabled` switch | service |
| `runner_plan_history`, `runner_launch_cohorts`, `runner_launch_grandfathered_plans` | Provenance and grandfathering of pre-launch plans | see docs |
| `runner_support_purchases` (+ intents, events) | "Contribuer" support purchase, one per user, apple/google; same nullable charge columns as unlocks | see doc |
| `subscriptions` | Legacy Stripe / RevenueCat entitlement snapshot (`provider`, `status`, `current_period_end`) | see doc |
| `premium_grants` | Manual premium overrides with optional `ends_at` | see doc |

## Organizer access & B2B billing

| Table | Purpose |
| --- | --- |
| `race_event_organizers` | Event-scoped membership (`event_id`, `user_id`, `role`, `revoked_at`); active = not revoked. |
| `race_event_claims` | Requests to claim an event. |
| `organizer_edition_entitlements` | Current tier per edition (`edition_id` unique; tiers `visibility` / `essential` / `complete` / `signature` since `20260908093008`), `source`, `status`. |
| `organizer_edition_payments` | Stripe / bank-transfer payments and generated invoices deriving entitlements. |
| `organizer_edition_capability_grants` | Complimentary per-edition feature grants. |
| `organizer_invoices`, `organizer_feature_catalog` | Manual invoicing; giftable feature catalog. |

Flyover video (independent product, `/survol`) : `flyover_video_orders` ([doc](../02-database/tables/flyover-video-orders.md)) — organizer order paid through Stripe (29,99 € collab / 59,99 € MP4; story mode and basemap chosen on the page, `story_mode` since 2026-11-22), service role only, linked to its `video_render_jobs` render (`race_id` now nullable, new `flyover_order_id`) and to its collab `social_posts` row (new `collaborators text[]`, ≤ 3).

Admin console journal (lot 3, 2026-11-23): `transactional_email_log` ([doc](../02-database/tables/transactional-email-log.md)) — one row per transactional Resend e-mail (category, `sent`/`skipped`/`failed`, code, masked recipient, no content), service role only, purged after 90 days by pg_cron; the functions `admin_cron_job_status()` / `admin_pg_net_response_summary()` expose pg_cron runs and pg_net HTTP errors to the service role ([doc](../02-database/admin-system-health-functions.md)).

Admin console journal (lot 7, 2026-11-23): `admin_audit_log` ([doc](../02-database/tables/admin-audit-log.md)) — one row per admin write action (actor, `domain.verb` action, target, French summary, sanitized `before`/`after` without secrets, message content or full e-mail, `ok`/`error`), service role only (append-only, no update), written best-effort by `lib/admin-audit-log.ts` and purged after 365 days by the pg_cron job `admin-audit-log-purge`.

Course terrain (lot 2, 2026-11-26): `race_course_terrain` ([doc](../02-database/tables/race-course-terrain.md)) — one row per race with a GPX (PK `race_id` → `races`, cascade): OpenStreetMap terrain segments (road / track / trail / technical / off_path) on the GPX km axis, coverage, organizer overrides (`organizer_overrides`, win over OSM, `overrides_gpx_sha256` to flag a GPX change) and the resumable job state (`status` pending/processing/ready/failed/no_route, `attempts`, `next_attempt_at` lease, `progress`). Service role only (RLS on, no policy); queued by a trigger on `races.gpx_storage_path` / `gpx_sha256`, computed by the pg_cron job `course-terrain`. Display-only: never read by pacing or nutrition.

Livret content: `race_event_edition_sponsors`, `race_event_edition_branding`, `race_event_edition_partner_slots`, `race_edition_services`, `race_start_waves`, `race_awards`, `race_event_updates`, versioned snapshots in `racebook_publications` / `racebook_publication_states`. See schema-overview.

## Known pitfalls

- Plans table is `race_plans` (not `plans`).
- Per-station product mix is stored in `race_plans.planner_values` JSONB (`aidStations[].supplies`), not in a relational table. `plan_aid_stations` has no product columns.
- Admin role is in `auth.users.raw_app_meta_data` (JWT `app_metadata`), not `user_profiles.role` (the column exists but is not trusted).
- Active products: `is_live = true AND is_archived = false`.
- No `water_ml` column on products. Electrolyte water is hardcoded at 500 ml per serving (`apps/web/lib/nutrition-planner.ts`).
- **Corrected:** GPX files *can* carry aid station data. `<wpt>` waypoints are normalized into aid stations (`apps/web/lib/gpx/normalizeImportedWaypoints.ts`); many GPX files (official traces) simply have none. Re-import risk is real but differs from the original note: the admin route `apps/web/app/api/race-catalog/[id]/gpx/route.ts` **deletes all `race_aid_stations` of the race** before inserting waypoint stations, so a re-upload overwrites manual stations (and a waypoint-less GPX wipes them). `last_gpx_import_at` / `needs_review` are only used by `apps/web/components/GpxAidStationImporter.tsx`, which is not imported anywhere, and these columns are not created by any visible migration.
- Catalog hierarchy is `race_events` → `race_event_editions` → `races`. `gpx_storage_path` and `gpx_sha256` are written only after a successful upload to the `race-gpx` bucket (the object is deleted if the row update fails). `gpx_path` / `gpx_hash` are legacy `race_catalog` columns, nullable since `20260909192254`, and are also written by seeds and the organizer import RPC.
- Expo Go: the app scheme is `paceyourself://` (`apps/mobile/app.config.ts`), not `pace-yourself://`. Custom schemes do not work in Expo Go; `makeRedirectUri` then yields an `exp://` URL, which must be whitelisted in Supabase Auth redirect URLs (the whitelist itself is dashboard config, not verifiable in the repo).
- `race_events` base table and `races.event_id` are not created in visible migrations.
- `/courses/evenements/<slug>` serves both edition slugs and event hub slugs: the two sets are kept disjoint by triggers on both tables. Do not write `race_events.slug` (immutable, no redirect table).
