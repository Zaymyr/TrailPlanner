---
title: RLS Policies
scope: database
last_verified: 2026-06-29
ai_priority: high
related_files:
  - supabase/migrations
  - supabase/migrations/20260618160000_add_organizer_dashboard_details.sql
  - supabase/migrations/20260629123858_add_race_event_favorites_and_updates.sql
  - supabase/tests/organizer_rls_checks.sql
  - apps/web/lib/supabase.ts
  - apps/web/lib/http.ts
  - apps/web/app/api/plan-shares/route.ts
  - apps/web/app/api/plan-shares/crew-state/route.ts
related_tables:
  - race_plans
  - plan_share_links
  - plan_aid_stations
  - races
  - race_aid_stations
  - race_aid_station_products
  - race_event_claims
  - race_event_organizers
  - race_event_updates
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

Some policy branches include legacy admin metadata checks. Do not copy them into new migrations.

### `race_aid_stations`

Declared through old `race_catalog_aid_stations` policies and renamed in `20260324000000_refactor_race_catalog_to_races.sql`.

- Aid stations are readable when their race is public/live or the requesting user owns the race.
- Insert/update/delete are allowed for admins and race owners according to parent race access.
- Organizer service routes can manage source aid stations after checking active `race_event_organizers` membership for the parent event.
- `solid_available` and `assistance_allowed` are columns on the existing table, so they inherit the same row policies as `water_available`.
- `organizer_details` is also a column on the existing table and inherits the same row policies; no separate JSONB grants or policies were added.

### Organizer Portal Tables

Declared in `20260528120000_add_organizer_portal.sql`.

`race_event_claims`:

- Authenticated users can insert pending claims for their own `user_id`.
- Users can select their own claims.
- Admins can select and update claims through trusted `app_metadata`.

`race_event_organizers`:

- Users can select their own memberships.
- Admins can select, insert, update, and delete memberships through trusted `app_metadata`.
- Active organizer access checks require `revoked_at is null`.

`race_aid_station_products`:

- Public/live race station product links are selectable.
- Race owners, active event organizers, and admins can select links for races they can manage.
- Active event organizers and admins can insert, update, and delete station-product links.
- Insert/update checks require the product to be live and non-archived, created by the acting user, or admin-visible.

Manual checks live in `supabase/tests/organizer_rls_checks.sql`.

### Event Favorites and Organizer Updates

Declared in `20260629123858_add_race_event_favorites_and_updates.sql`.

`user_favorite_race_events`:

- Authenticated users can select only their own favorites.
- Authenticated users can insert favorites only for their own `user_id`.
- Authenticated users can delete only their own favorites.
- The table grants no cross-user read access; organizer UIs should use service routes when they need aggregate counts.

`race_event_updates`:

- `anon` and `authenticated` can select rows only when the parent `race_events` row is live.
- Authenticated organizers and admins can insert rows only for events they actively manage, with `created_by = auth.uid()`.
- No direct client update/delete path is documented; organizer writes are append-only through the server route.

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
- Admin organizer policies must be paired with SQL grants for the relevant action; RLS policies alone do not grant table privileges.
- Organizer portal membership checks are event-based. Do not replace them with `races.created_by`.
- Event-favorite ownership and organizer-update audience selection are separate concerns. Do not grant organizers direct read access to follower rows just because they can send updates.
- Adding service-flag columns to `race_aid_stations` does not grant new row access; keep organizer mutations behind the existing service-route membership check.
- Adding organizer dashboard JSONB columns to existing source tables does not grant new row access. Keep event/race/station mutations behind the existing organizer service routes and active membership checks.
- Public share links still need owner RLS even though the public page uses service role; route code must verify parent plan ownership before creating a link.
- Public share link re-shares update existing rows through the same service route, so update paths need the same parent-plan ownership verification as inserts.
- Public crew-state mutations are intentionally secret-link mutations, not authenticated owner mutations. Keep their writable columns narrow and do not grant direct `anon` access to `plan_share_links`.

## Related Docs

- [RLS Checklist](../04-auth-and-security/rls-checklist.md)
- [Add RLS Policy](../06-workflows/add-rls-policy.md)
- [Schema Overview](schema-overview.md)
- [Premium Grants](tables/premium-grants.md)
- [Plan Share Links](tables/plan-share-links.md)
- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
