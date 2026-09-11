---
title: RLS Checklist
scope: auth
last_verified: 2026-09-11
ai_priority: high
related_files:
  - supabase/migrations
  - supabase/migrations/20260618160000_add_organizer_dashboard_details.sql
  - supabase/migrations/20260804143259_add_onboarding_completion_to_user_profiles.sql
  - supabase/migrations/20260830154837_add_mobile_onboarding_statuses.sql
  - supabase/migrations/20260820135823_add_racebook_publication_control.sql
  - supabase/migrations/20260820164141_target_racebook_publication_requests.sql
  - supabase/migrations/20260824114439_add_organizer_import_sessions_and_drafts.sql
  - supabase/migrations/20260824164101_manage_organizer_edition_visibility_and_deletion.sql
  - supabase/migrations/20260824170652_restrict_delete_race_event_edition_rpc.sql
  - supabase/migrations/20260828161008_add_race_slug_redirects.sql
  - supabase/migrations/20260829080943_update_amazeaunes_2026_final_roadbook.sql
  - supabase/migrations/20260829204139_ensure_race_event_editions_for_formats.sql
  - supabase/migrations/20260829204018_add_racebook_edition_sponsors.sql
  - supabase/migrations/20260903095451_add_admin_kpi_aggregates.sql
  - supabase/migrations/20260907170842_fix_structured_racebook_rls_dependencies.sql
  - supabase/migrations/20260907171043_add_racebook_edition_branding.sql
  - supabase/migrations/20260908093008_add_organizer_offer_modules_v2.sql
  - supabase/migrations/20260911073318_add_organizer_manual_payments_and_invoices.sql
  - supabase/migrations/20260908160018_preserve_global_start_time_without_waves.sql
  - supabase/migrations/20260910061433_import_utmb_world_series_catalog_2026_2027.sql
  - supabase/migrations/20260910074418_add_normalized_race_event_geography.sql
  - supabase/migrations/20260910081049_add_atomic_organizer_course_collections.sql
  - supabase/migrations/20260910210621_align_organizer_format_visibility_states.sql
  - supabase/migrations/20260911091935_fix_bulk_organizer_racebook_publication.sql
  - supabase/migrations/20260911093649_add_organizer_publication_grant_origin.sql
  - supabase/migrations/20260911110037_fix_organizer_publication_and_manual_payment_consistency.sql
  - supabase/migrations/20260911114106_expose_private_formats_in_visible_catalog.sql
  - supabase/migrations/20260910082051_backfill_catalog_race_event_geography.sql
  - supabase/migrations/20260910103118_enrich_catalog_through_may_2027.sql
  - supabase/migrations/20260910083131_correct_translantau_country_code.sql
  - supabase/tests/organizer_racebook_module_settings_checks.sql
  - supabase/tests/racebook_branding_checks.sql
  - supabase/tests/organizer_rls_checks.sql
  - supabase/tests/organizer_import_sessions_checks.sql
  - supabase/tests/race_slug_redirects_checks.sql
  - supabase/tests/racebook_sponsors_checks.sql
  - supabase/tests/organizer_atomic_course_collections_checks.sql
  - supabase/migrations/20260910204823_add_organizer_dashboard_onboarding.sql
  - supabase/tests/organizer_dashboard_onboarding_checks.sql
  - supabase/tests/organizer_edition_entitlements_checks.sql
  - apps/web/lib/supabase.ts
  - apps/web/lib/http.ts
  - apps/web/app/api/plan-shares/route.ts
  - apps/web/app/api/plan-shares/crew-state/route.ts
related_tables:
  - race_plans
  - organizer_import_sessions
  - plan_share_links
  - races
  - race_slug_redirects
  - race_events
  - race_aid_stations
  - user_profiles
  - subscriptions
  - premium_grants
  - race_event_claims
  - race_event_organizers
  - race_aid_station_products
  - race_event_update_reads
  - race_event_edition_sponsors
  - race_event_edition_branding
  - organizer_racebook_module_settings
---

# RLS Checklist

## Purpose

Use this checklist before adding or changing Supabase tables, policies, or service-role routes.

`organizer_racebook_module_settings` is service-only: client roles have no table privileges or policies. Published structured collections use the narrow `private.racebook_module_is_enabled` security-definer helper to combine the active entitlement and stored module switch. The helper exposes only a boolean and keeps its explicit search path and execute grants bounded to the API roles.

`publish_organizer_edition_racebooks` is likewise `SECURITY INVOKER` and executable only by `service_role`. The Next.js route verifies trusted organizer/admin access before calling it; the function independently rechecks edition visibility and entitlement, and atomically restores course/preview/RaceBook visibility for complete public-source formats selected through `racebook_preview_is_visible`. It deliberately does not require prior `is_live`, because organizer-private rows are the normal input.

`record_admin_organizer_bank_transfer` is also invoker-security and service-role-only. The admin route verifies `app_metadata`, validates date/money/PDF input, and cleans an uploaded object if the atomic database write fails. `organizer-invoices` has no direct client policy; the download route rechecks active parent-event membership before signing a manual object for 60 seconds.

`set_admin_organizer_edition_grant` is invoker-security and service-role-only. It permits direct Admin/Offert grants, but restores Stripe or virement only from a matching valid payment path, so the presentation origin cannot manufacture financial history.

`set_organizer_racebook_visibility` remains invoker-security and service-role-only. It repeats the server route's caller model by accepting an active event membership or a trusted admin resolved only from `auth.users.raw_app_meta_data`; it never consults user-editable metadata.

## Key Concepts

- RLS: row-level security enforced by Postgres.
- Owner policy: `auth.uid() = user_id`.
- Parent policy: access checked through a parent table relationship.
- Service route: server-only route using service-role key.
- SECURITY DEFINER: database function that performs privileged work safely.

## Checklist

1. Identify whether the table is user-owned, public catalog, admin-managed, or service-only.
2. Add `alter table ... enable row level security`.
3. Add select/insert/update/delete policies explicitly; do not rely on grants alone.
4. Use `auth.uid()` for owner checks.
5. Use parent-table `exists` checks for child rows such as `plan_aid_stations`.
6. Use `app_metadata` or server/profile checks for admin authorization.
7. Do not use `user_metadata` for new authorization decisions.
8. Grant table privileges only when the RLS policy should be reachable by that role.
9. Keep service-role access in Next.js server routes or Supabase functions only.
10. Add or update a test/manual SQL check when policy behavior is non-trivial.
11. For commercial capabilities, enforce the entitlement on the service route and repeat it in direct RLS/read overlays where a client could bypass that route.
12. For service-only destructive RPCs, prefer `SECURITY INVOKER`, revoke `PUBLIC`, grant only `service_role`, and keep the user-to-parent authorization check in the server route.
13. When adding columns to an existing RLS-protected table, confirm the existing row policies still match the new data sensitivity.

## Correct Parent Policy Shape

```sql
create policy "Users can view child rows"
on public.child_table
for select
using (
  exists (
    select 1
    from public.parent_table
    where parent_table.id = child_table.parent_id
      and parent_table.user_id = auth.uid()
  )
);
```

## Forbidden Pattern

```sql
using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
```

`user_metadata` can be user-controlled and must not be the basis for new admin access.

## Validation

Use:

- `supabase/tests/organizer_rls_checks.sql` for event-membership and organizer station-product checks;
- `supabase/tests/organizer_rls_checks.sql` for event membership, race-event favorites, format-scoped updates, and owner-only update read receipts;
- `supabase/tests/organizer_import_sessions_checks.sql` for service-only session grants, invoker RPC privileges, strict JSON payloads, and draft constraints;
- `supabase/tests/race_slug_redirects_checks.sql` for public parent-gated redirect reads, service-only mutations/RPC execution, invoker security, and reserved-slug behavior;
- `supabase/tests/racebook_sponsors_checks.sql` for sponsor-table RLS/privileges, edition limits, loading limits, and atomic aggregate click increments;
- `supabase/tests/organizer_atomic_course_collections_checks.sql` for client execute revocations, parent ownership validation and rollback of Organizer collection/product mutations;
- `supabase/tests/racebook_branding_checks.sql` for service-only branding privileges, one-row edition scope, cascade, checked colors, and atomic draft publication;
- `supabase/tests/organizer_edition_entitlements_checks.sql` for Stripe/manual recalculation, complimentary-override conversion, duplicate/downgrade rejection, invoice-bucket privacy configuration, and bank-transfer RPC privileges;
- app route tests when policy behavior is exercised through Next.js APIs;
- SQL editor/psql sessions with `set local role authenticated` and `request.jwt.claim.sub` for manual checks.

## Gotchas

- A child-table RLS policy runs with the querying role's privileges for referenced parents. Do not join `race_event_editions` from a client policy while that parent remains service-role-only; use the already-readable `races` publication relationship or a separately reviewed narrow access boundary.

- `delete_race_event_edition` intentionally relies on the service role's existing table privileges while preserving invoker security. Do not convert it to `SECURITY DEFINER` or grant it directly to authenticated clients.
- This project has direct default `EXECUTE` grants for `anon` and `authenticated`; for every new service-only function, revoke those roles explicitly in addition to `PUBLIC`, then verify with `has_function_privilege`.
- Replacing `replace_race_start_waves` to preserve the common start time when no waves remain does not broaden access: keep it `SECURITY INVOKER`, with an empty search path and execution restricted to `service_role`.
- Admin aggregate KPI functions are a justified `SECURITY DEFINER` exception because they read `auth.users` and cross-owner rows. Keep their empty search path, service-role-only execute grant, bounded date range, and route-level trusted-admin authorization together.
- `assign_race_event_edition()` remains `SECURITY INVOKER`, receives no client table privileges, and has explicit `PUBLIC`/`anon`/`authenticated` execute revocations; it is a service-write consistency trigger, not an authorization bypass.
- Public child mappings such as `race_slug_redirects` need an explicit client `SELECT` grant plus an RLS `exists` check against every parent visibility gate. Keep all writes and the rename RPC service-role-only.

- Service role bypasses RLS, so passing a service-route test does not prove client RLS works.
- `anon` grants are intentional for anonymous Supabase users only when policies still bind to `auth.uid()`.
- Archived schema docs may show stale policy names.
- Avoid overloading owner columns for presentation metadata. For example, `products.is_official` is the official/shared catalog flag; `products.created_by` remains ownership only.
- Data-only official product imports that only upsert `products` rows can reuse existing product RLS policies; changing grants, views, functions, or ownership semantics requires the full checklist.
- Data-only official product image backfills can reuse existing product RLS policies when they only update `products.image_url` and keep ownership, grants, and visibility unchanged.
- Data-only roadbook corrections can reuse the existing event/edition/race policies when they change only trusted catalog rows and organizer JSON. The Les Amaz’Eaunes 2026 migration changes no grants, policies, ownership, or publication state.
- Curated catalog data migrations may insert or enrich trusted public event, edition, and race rows under the existing policies. The September 2026 SEO batches add no grants, policies, functions, or client-write paths.
- The official UTMB World Series migration is data-only. It reuses the existing event, edition, and race policies and adds no grants, policies, functions, ownership semantics, or client-write path.
- Normalized `race_events` geography is public catalog metadata on an existing RLS-protected table. Its migration adds no grants or policies; the stale-data trigger is invoker-security and direct execution is revoked from `PUBLIC`, `anon`, and `authenticated`.
- The catalog-wide geography backfill is data-only. It reuses the existing `race_events` policies, preserves current publication and ownership fields, and introduces no function, grant, policy, or client-write path.
- The March–May 2027 organizer-source batch is also data-only. It reuses existing event, edition, and race access controls, exposes only rows already marked live/public through existing policies, and adds no grant, function, policy, or client-write path.
- Event-scoped organizer policies need both claim/member RLS and route-level service-role authorization checks. Service-role route success alone does not prove direct RLS behavior.
- New service flags on `race_aid_stations` reuse the existing station row policies; do not add separate grants for them.
- New organizer JSONB columns on existing source tables reuse their table row policies; do not add separate grants or bypass active `race_event_organizers` checks for them.
- New organizer grouping columns such as `races.edition_group_id` and `races.series_name` are the same kind of column-only change: verify sensitivity, then reuse the existing `races` policies unless the access model itself changes.
- Secret-link tables such as `plan_share_links` still need owner RLS. Public viewers should resolve unguessable tokens through server/service-role code, not direct `anon` table grants.
- Re-sharing a plan can update an existing `plan_share_links` snapshot, so the service route must verify both bearer-token identity and parent-plan ownership before update as well as insert.
- Public crew-state updates for `plan_share_links` are allowed only through a token-hash service route and should remain limited to `departure_time` and `crew_state`.
- Mobile onboarding markers and per-tour statuses are column-only owner data. Existing profile select/insert/update policies remain the correct boundary; no new grant or policy is required.
- Organizer dashboard onboarding is a column-only addition to the existing membership row. The browser completion endpoint must still verify the bearer user owns an active membership for the requested event before writing with service role.
- Read receipts require both owner equality and a live parent event; ownership alone must not allow receipts for hidden draft announcements.
- Racebook publication remains behind service routes: organizer toggles require active event membership or a trusted app-metadata admin, a complete format, and an active edition-level `racebook.publish` capability. The atomic RPC writes durable unlock provenance on first publication; legacy publication requests remain service-only audit data.
- Keep the bulk publication SQL test asserting both sides of the private-to-public transition: the update sets `is_live = true`, and its predicate never requires `race_row.is_live = true`.
- The `races_select` policy exposes preview-selected private formats to runners only when the parent event and optional edition are visible. Its `private.race_is_in_visible_catalog` security-definer helper has an empty search path, returns only a boolean, revokes `PUBLIC`, and grants execution only to `anon`/`authenticated`, avoiding a direct edition-table grant. Masked rows remain creator/member/admin scoped. Transitions remain server-mediated, and the publication RPC stays `SECURITY INVOKER` with execution restricted to `service_role`.
- Superseding organizer-offer rule: paid publication uses a service-only edition entitlement and atomic RPC. Notification, relay, and station-product clients have no direct mutation grant; public Pro overlays use only the narrow private boolean helper.
- The organizer website-import route is admin-only even though its target event may be organizer-managed. Keep this route behind trusted `app_metadata` admin checks and never authorize LLM reconciliation from client role input.
- `organizer_import_sessions` is service-only workflow state: no client policy is intentional. Both mutation RPCs must remain `SECURITY INVOKER`, revoke `PUBLIC` execution, and validate session expiry/scope plus every JSON key before writing.
- `race_event_edition_sponsors` is also intentionally service-only. Public presentation must pass through the RaceBook gate and expose counted redirect URLs rather than direct destination fields.
- Atomic Organizer course and sponsor-order functions remain invoker-security, empty-search-path and `service_role`-only. Their database validation complements rather than replaces route membership and entitlement checks.
- `race_event_edition_branding` is intentionally service-only. Its organizer route requires active parent-event membership plus Pro; public/mobile presentation must expose only the published snapshot and keep downgrade behavior read-only rather than destructive.

## Related Docs

- [RLS Policies](../02-database/rls-policies.md)
- [Race Slug Redirects](../02-database/tables/race-slug-redirects.md)
- [Add RLS Policy](../06-workflows/add-rls-policy.md)
- [Auth Flows](auth-flows.md)
- [Schema Overview](../02-database/schema-overview.md)
- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
