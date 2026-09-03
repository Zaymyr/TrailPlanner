---
title: RLS Policies
scope: database
last_verified: 2026-09-03
ai_priority: high
related_files:
  - supabase/migrations
  - supabase/migrations/20260618160000_add_organizer_dashboard_details.sql
  - supabase/migrations/20260629123858_add_race_event_favorites_and_updates.sql
  - supabase/migrations/20260820130930_add_format_targeted_race_updates.sql
  - supabase/migrations/20260804152041_add_race_event_editions.sql
  - supabase/migrations/20260820135823_add_racebook_publication_control.sql
  - supabase/migrations/20260820164141_target_racebook_publication_requests.sql
  - supabase/migrations/20260826090000_allow_event_level_publication_requests.sql
  - supabase/migrations/20260804143259_add_onboarding_completion_to_user_profiles.sql
  - supabase/migrations/20260830154837_add_mobile_onboarding_statuses.sql
  - supabase/migrations/20260824114439_add_organizer_import_sessions_and_drafts.sql
  - supabase/migrations/20260824152859_add_relay_course_points.sql
  - supabase/migrations/20260824164101_manage_organizer_edition_visibility_and_deletion.sql
  - supabase/migrations/20260824170652_restrict_delete_race_event_edition_rpc.sql
  - supabase/migrations/20260828161008_add_race_slug_redirects.sql
  - supabase/migrations/20260829080943_update_amazeaunes_2026_final_roadbook.sql
  - supabase/migrations/20260829204018_add_racebook_edition_sponsors.sql
  - supabase/migrations/20260903095451_add_admin_kpi_aggregates.sql
  - supabase/tests/racebook_sponsors_checks.sql
  - supabase/tests/organizer_rls_checks.sql
  - supabase/tests/organizer_import_sessions_checks.sql
  - supabase/tests/race_slug_redirects_checks.sql
  - apps/web/lib/supabase.ts
  - apps/web/lib/http.ts
  - apps/web/app/api/plan-shares/route.ts
  - apps/web/app/api/plan-shares/crew-state/route.ts
related_tables:
  - race_plans
  - organizer_import_sessions
  - plan_share_links
  - plan_aid_stations
  - races
  - race_slug_redirects
  - race_aid_stations
  - race_relay_points
  - race_aid_station_products
  - race_event_claims
  - race_event_edition_requests
  - race_event_editions
  - race_event_edition_sponsors
  - race_event_publication_requests
  - race_event_organizers
  - race_event_publication_requests
  - race_event_updates
  - race_event_update_reads
  - race_events
  - products
  - user_favorite_race_events
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
- SECURITY INVOKER RPC: preferred service-only mutation that retains the caller's privileges and transaction boundary.
- SECURITY DEFINER RPC: exceptional privileged function that requires a fixed search path, narrow grants, and explicit authorization.

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

Declared in `20241215010000_create_race_plans.sql`; legacy coach policy branches were removed by `20260618145940_remove_coach_features.sql`.

- Users can select own rows where `auth.uid() = user_id`.
- Users can insert own rows.
- Users can update own rows.
- Users can delete own rows.
- Anonymous authenticated Supabase users are allowed through `auth.uid()` after `20260326000000_allow_anon_race_plans.sql` grants table privileges to `anon`.

### `plan_aid_stations`

Declared in `20251220120000_add_race_catalog.sql`.

- Users can select rows whose parent `race_plans.user_id = auth.uid()`.
- Users can insert rows for own parent plans.
- Users can update rows for own parent plans.
- Users can delete rows for own parent plans.

### `plan_share_links`

Declared in `20260609091933_add_plan_share_links.sql`.

- Authenticated users can select their own share links where `auth.uid() = user_id`.
- Authenticated users can insert share links only when `auth.uid() = user_id` and the parent `race_plans.user_id = auth.uid()`.
- Authenticated users can update share links only under the same owner and parent-plan ownership checks.
- Authenticated users can delete their own share links.
- `anon` is not granted direct table access. Public crew pages resolve the token through a Next.js server page using service role after hashing the raw URL token.
- Crew-side public updates also avoid direct `anon` table access. `apps/web/app/api/plan-shares/crew-state/route.ts` validates the raw secret token, hashes it, rate-limits by token hash, and patches only `departure_time` plus `crew_state` with service role.

Re-sharing uses the same owner policy shape: the route verifies bearer-token identity and parent-plan ownership before updating an existing stable snapshot.

### `races`

Declared through old `race_catalog` policies and renamed/refined in `20260324000000_refactor_race_catalog_to_races.sql`.

- Public/live races are readable.
- Private races are readable by their creator.
- Admins can manage catalog races.
- Owners can manage private races through `created_by`.
- Approved organizers manage public claimed races through service routes and `race_event_organizers`, not through `races.created_by`.
- `races.organizer_details` is a column on the existing table and inherits these row policies; organizer writes still go through service routes after event membership checks.
- `races.edition_group_id` and `races.series_name` inherit the same `races` row policies; the organizer edition-grouping migration adds no new grants or RLS branches.
- Racebook publication columns inherit the existing `races` row policies. Organizer toggles remain behind the membership-checked service route and atomic RPC, which requires the edition-level `racebook.publish` capability and records first-publication provenance.

Some policy branches include legacy admin metadata checks. Do not copy them into new migrations.

### `race_aid_stations`

Declared through old `race_catalog_aid_stations` policies and renamed in `20260324000000_refactor_race_catalog_to_races.sql`.

- Aid stations are readable when their race is public/live or the requesting user owns the race.
- Insert/update/delete are allowed for admins and race owners according to parent race access.
- Organizer service routes can manage source aid stations after checking active `race_event_organizers` membership for the parent event.
- `solid_available` and `assistance_allowed` are columns on the existing table, so they inherit the same row policies as `water_available`.
- `organizer_details` is also a column on the existing table and inherits the same row policies; no separate JSONB grants or policies were added.

### `race_relay_points`

- Public select requires the parent race to be public, course-live, Racebook-live, and covered by Pro.
- Parent owners, active event organizers, and trusted `app_metadata` admins can select managed rows.
- Insert/update/delete grants are service-role-only; Organizer writes stay behind the membership-checked web route.
- Indexes cover ordered parent-race reads and the optional aid-station foreign key.

### Organizer Portal Tables

Declared in `20260528120000_add_organizer_portal.sql`.

`race_event_claims`:

- Authenticated users can insert pending claims for their own `user_id`.
- Users can select their own claims.
- Admins can select and update claims through trusted `app_metadata`.

`race_event_edition_requests`:

- Retained legacy rows remain selectable under the historical policies.
- Authenticated insert/update grants and the organizer insert policy are removed by the publication-request migration.

`race_event_editions`:

- RLS is enabled, but direct `anon` and `authenticated` privileges are revoked.
- Only `service_role` can select or mutate rows; organizer API routes first enforce active event membership.
- The current-edition trigger mirrors dates into legacy event fields, but does not grant client access.
- `delete_race_event_edition` is `SECURITY INVOKER`, revoked from `PUBLIC`, and executable only by `service_role`; the edition route checks active event membership before invoking it.
- Because this project's default ACL grants function execution directly to API roles, the repair migration also revokes `anon` and `authenticated` explicitly from the deletion RPC and both trigger functions.

`race_event_edition_sponsors`:

- RLS is enabled with no client policy, and table privileges are revoked from `PUBLIC`, `anon`, and `authenticated`.
- Only `service_role` can select or mutate sponsor rows. Organizer routes first require active membership on the edition's parent event; the public mobile route applies the RaceBook live gate or organizer-preview exception.
- `increment_racebook_sponsor_click(uuid, uuid)` is `SECURITY INVOKER`, executable only by `service_role`, and increments only when the sponsor is active, has a target, and shares the requested race's edition.
- Only one aggregate `click_count` is stored. The route hashes the network identifier only for transient rate-limit selection and stores no identity or individual click row.

`race_event_publication_requests`:

- Active event members can insert pending requests for themselves; `race_id` is null for the current event-level flow, or must belong to the same managed event for any legacy per-format row. Organizers can read their own requests.
- Trusted admins read the queue through the service API.
- Atomic approval of a null-`race_id` request publishes every complete format of the event's current edition together; a legacy non-null `race_id` still targets just that format. The admin event-level Racebook switch also targets the current edition. Both invoker-security RPCs are executable only by `service_role`; organizers receive no direct table/RPC grant and mutate approved visibility only through a membership-checked service route.

`race_event_organizers`:

- Users can select their own memberships.
- Admins can select, insert, update, and delete memberships through trusted `app_metadata`.
- Active organizer access checks require `revoked_at is null`.

`race_aid_station_products`:

- Public/live station product links are selectable only for Pro editions; organizers/admins keep preview reads.
- Race owners, active event organizers, and admins can select links for races they can manage.
- Direct authenticated insert/update/delete is revoked. Pro-checked service routes perform organizer mutations with service role.

Manual checks live in `supabase/tests/organizer_rls_checks.sql`.

`organizer_import_sessions`:

- RLS is enabled with no client policy.
- `PUBLIC`, `anon`, and `authenticated` have no table privileges; only `service_role` can select or mutate rows.
- `confirm_organizer_import_formats` and `apply_organizer_import_field_patches` are `SECURITY INVOKER`, reject non-allowlisted JSON, and grant execute only to `service_role`.
- The field RPC validates every target against the session event, edition, confirmed format map, state, and expiry before applying one atomic transaction.
- `configure_organizer_import_cleanup_cron` is the narrow SECURITY DEFINER exception required to read Vault and manage pg_cron. It grants execute only to `service_role`.

Manual permission, constraint, draft-transition, and RPC checks live in `supabase/tests/organizer_import_sessions_checks.sql`.

### Organizer Commercial Rights

`organizer_edition_entitlements` and `organizer_edition_payments` are RLS-enabled service-only tables with explicit client revokes. A fixed-search-path private function returns only whether an edition is Pro so public relay/product child policies can enforce the commercial gate without exposing payment or grant rows.

### Event Favorites and Organizer Updates

Declared in `20260629123858_add_race_event_favorites_and_updates.sql`.

`user_favorite_race_events`:

- Authenticated users can select only their own favorites.
- Authenticated users can insert favorites only for their own `user_id`.
- Authenticated users can delete only their own favorites.
- The table grants no cross-user read access; organizer UIs should use service routes when they need aggregate counts.

`race_event_updates`:

- `anon` and `authenticated` can select rows only when the parent `race_events` row is live.
- Direct authenticated inserts are revoked. The organizer server route requires the selected edition's `followers.notify` capability before writing and delivering push notifications.
- No direct client update/delete path is documented; organizer writes are append-only through the server route.

`race_event_update_reads`:

- Authenticated users can select only their own receipts.
- Authenticated users can insert only their own receipts and only for updates whose parent event is live.
- The composite `(update_id, user_id)` primary key keeps repeated read marking idempotent; no client update/delete path is granted.

### `products`

Declared in `20241215030000_create_products_and_affiliate_offers.sql`, `20250902121500_allow_anon_read_products.sql`, and `20260322100000_add_created_by_to_products.sql`.

- Service role can manage products.
- Authenticated users can read live, non-archived products.
- Anon can read live, non-archived products.
- Users can read their own products through `created_by`.

`products.is_official` is catalog metadata only. It does not change who can read or mutate a row; ownership and mutation checks still flow through `created_by`, admin checks, or service role.

Organizer-created station products are stored as non-live, non-official `products` rows with `created_by` set. They remain readable to the creator through the existing owner policy and are surfaced to runners through the server-side catalog import path, not the global `/api/products` catalog.

`20260526120000_add_meltonic_products.sql` only upserts live official catalog product rows. It relies on the existing live-product read policies and adds no product RLS policy.

`20260526135521_add_meltonic_product_images.sql` only backfills `image_url` for the official Meltonic catalog rows. It does not change ownership, visibility, grants, or product RLS policies.

### `user_profiles`

Declared in `20250624103000_add_user_profiles.sql`.

- Users can select own profile.
- Users can insert own profile.
- Users can update own profile.

The auth trigger in `20260408100000_initialize_trial_profile_on_user_created.sql` uses SECURITY DEFINER to create/repair profile rows after auth user creation.
The legacy `user_profiles.onboarding_completed_at` marker and the Plan/RaceBook status columns are owner-only column additions. They inherit the same profile select/insert/update policies; mobile writes them using the active user's session and explicit ownership key/filter.

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

### Push Tables

Declared in `20260504120000_add_push_notifications.sql`.

- `push_devices`: service role manages; users can select/insert/update/delete own devices.
- `push_notification_events`: service role manages; users can select own events.
- `push_notification_events.notification_kind` is also used for manual organizer sends with `organizer-race-update`; dedupe remains device-scoped through `push_device_id,dedupe_key`.

### Other Tables

- `race_slug_redirects`: `anon` and `authenticated` can select only mappings whose target race is live/public and whose optional parent event is live. All mutations and the invoker-security rename RPC are service-role-only.
- `affiliate_offers`: service role manages; authenticated users read active offers attached to live products.
- `affiliate_click_events`: service role manages.
- `affiliate_events`: service role manages; authenticated users insert events for self or anonymous session.
- `app_feedback`: authenticated users can insert after later migration.
- `app_changelog`: authenticated users can view.
- `race_requests`: authenticated users can insert and read own requests.
- `nutrition_plans`: users can insert and view own rows.
- Legacy coach/coachee tables and RLS policies were removed by `20260618145940_remove_coach_features.sql`.

## SECURITY DEFINER Use

Use SECURITY DEFINER when a function must do work the caller cannot safely do directly:

- reading or reacting to `auth.users`;
- atomically updating rate limit rows;
- validating cron secrets without exposing Vault values;
- computing analytics across auth/profile data.

Every SECURITY DEFINER function should set `search_path` explicitly when it touches user-controlled schemas.

The admin KPI functions `get_admin_growth_metrics` and `get_admin_affiliate_metrics` require cross-user/Auth reads and therefore use `SECURITY DEFINER` with `search_path = ''`. They have explicit execution revocations for `PUBLIC`, `anon`, and `authenticated`, and only `service_role` may call them. Next.js routes still perform the trusted `app_metadata` admin check before using the service key.

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
- The coach/coachee feature is retired; do not add broad coach-role access or restore historical coach policies without a new design.
- For product catalog UX, do not derive "official/shared" from `created_by is null`. Ownership and catalog curation are separate concerns.
- Data-only official product imports do not require new policies when they only set catalog metadata and live visibility on the existing `products` table.
- Data-only product image backfills do not require new policies when they only update public `image_url` values on existing live catalog rows.
- Data-only final-roadbook corrections on existing `race_events`, `race_event_editions`, and `races` rows reuse their current policies and grants; the Les Amaz’Eaunes 2026 synchronization adds no client access or policy branch.
- Admin organizer policies must be paired with SQL grants for the relevant action; RLS policies alone do not grant table privileges.
- Organizer portal membership checks are event-based. Do not replace them with `races.created_by`.
- Event-favorite ownership and organizer-update audience selection are separate concerns. Do not grant organizers direct read access to follower rows just because they can send updates.
- Push delivery logs and read receipts have different security boundaries. Keep runner-visible state in owner-scoped `race_event_update_reads`, not in service-managed `push_notification_events`.
- Adding service-flag columns to `race_aid_stations` does not grant new row access; keep organizer mutations behind the existing service-route membership check.
- Adding organizer dashboard JSONB columns to existing source tables does not grant new row access. Keep event/race/station mutations behind the existing organizer service routes and active membership checks.
- Public share links still need owner RLS even though the public page uses service role; route code must verify parent plan ownership before creating a link.
- Public share link re-shares update existing rows through the same service route, so update paths need the same parent-plan ownership verification as inserts.
- Public crew-state mutations are intentionally secret-link mutations, not authenticated owner mutations. Keep their writable columns narrow and do not grant direct `anon` access to `plan_share_links`.
- Adding onboarding markers/statuses does not broaden profile visibility or mutation rights; do not add separate policies while the row remains owner-scoped.
- Adding Racebook publication columns does not grant organizer table access. Keep approval RPCs service-role-only and organizer visibility changes behind active event-membership checks.
- Edition visibility/deletion adds no client grant. Keep both operations on the membership-checked server route and keep the deletion RPC invoker-security/service-role-only.
- Import sessions deliberately have no authenticated policy. Keep both JSON RPCs invoker-security and service-role-only; route-level admin validation does not justify direct browser grants.
- The cleanup cron must call the protected web route so Storage objects are removed before session rows. Never grant a database cleanup function direct delete access to `storage.objects`.
- Public slug resolution needs both a table `SELECT` grant and the parent-gated RLS policy. Never grant client mutation or RPC execution, and never rely on a redirect row alone to expose a hidden course.
- RaceBook sponsor presentation and redirects must remain server-mediated. Do not grant public table reads merely because logos and names eventually appear on a live RaceBook.

## Related Docs

- [RLS Checklist](../04-auth-and-security/rls-checklist.md)
- [Add RLS Policy](../06-workflows/add-rls-policy.md)
- [Schema Overview](schema-overview.md)
- [Premium Grants](tables/premium-grants.md)
- [Plan Share Links](tables/plan-share-links.md)
- [Race Slug Redirects](tables/race-slug-redirects.md)
- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
