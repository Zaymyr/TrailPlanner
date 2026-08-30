---
title: RLS Checklist
scope: auth
last_verified: 2026-08-30
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
  - supabase/tests/organizer_rls_checks.sql
  - supabase/tests/organizer_import_sessions_checks.sql
  - supabase/tests/race_slug_redirects_checks.sql
  - supabase/tests/racebook_sponsors_checks.sql
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
---

# RLS Checklist

## Purpose

Use this checklist before adding or changing Supabase tables, policies, or service-role routes.

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
- app route tests when policy behavior is exercised through Next.js APIs;
- SQL editor/psql sessions with `set local role authenticated` and `request.jwt.claim.sub` for manual checks.

## Gotchas

- `delete_race_event_edition` intentionally relies on the service role's existing table privileges while preserving invoker security. Do not convert it to `SECURITY DEFINER` or grant it directly to authenticated clients.
- This project has direct default `EXECUTE` grants for `anon` and `authenticated`; for every new service-only function, revoke those roles explicitly in addition to `PUBLIC`, then verify with `has_function_privilege`.
- `assign_race_event_edition()` remains `SECURITY INVOKER`, receives no client table privileges, and has explicit `PUBLIC`/`anon`/`authenticated` execute revocations; it is a service-write consistency trigger, not an authorization bypass.
- Public child mappings such as `race_slug_redirects` need an explicit client `SELECT` grant plus an RLS `exists` check against every parent visibility gate. Keep all writes and the rename RPC service-role-only.

- Service role bypasses RLS, so passing a service-route test does not prove client RLS works.
- `anon` grants are intentional for anonymous Supabase users only when policies still bind to `auth.uid()`.
- Archived schema docs may show stale policy names.
- Avoid overloading owner columns for presentation metadata. For example, `products.is_official` is the official/shared catalog flag; `products.created_by` remains ownership only.
- Data-only official product imports that only upsert `products` rows can reuse existing product RLS policies; changing grants, views, functions, or ownership semantics requires the full checklist.
- Data-only official product image backfills can reuse existing product RLS policies when they only update `products.image_url` and keep ownership, grants, and visibility unchanged.
- Data-only roadbook corrections can reuse the existing event/edition/race policies when they change only trusted catalog rows and organizer JSON. The Les Amaz’Eaunes 2026 migration changes no grants, policies, ownership, or publication state.
- Event-scoped organizer policies need both claim/member RLS and route-level service-role authorization checks. Service-role route success alone does not prove direct RLS behavior.
- New service flags on `race_aid_stations` reuse the existing station row policies; do not add separate grants for them.
- New organizer JSONB columns on existing source tables reuse their table row policies; do not add separate grants or bypass active `race_event_organizers` checks for them.
- New organizer grouping columns such as `races.edition_group_id` and `races.series_name` are the same kind of column-only change: verify sensitivity, then reuse the existing `races` policies unless the access model itself changes.
- Secret-link tables such as `plan_share_links` still need owner RLS. Public viewers should resolve unguessable tokens through server/service-role code, not direct `anon` table grants.
- Re-sharing a plan can update an existing `plan_share_links` snapshot, so the service route must verify both bearer-token identity and parent-plan ownership before update as well as insert.
- Public crew-state updates for `plan_share_links` are allowed only through a token-hash service route and should remain limited to `departure_time` and `crew_state`.
- Mobile onboarding markers and per-tour statuses are column-only owner data. Existing profile select/insert/update policies remain the correct boundary; no new grant or policy is required.
- Read receipts require both owner equality and a live parent event; ownership alone must not allow receipts for hidden draft announcements.
- Racebook publication remains behind service routes: organizer toggles require active event membership, a complete format, and an active edition-level `racebook.publish` capability. The atomic RPC writes durable unlock provenance on first publication; legacy publication requests remain service-only audit data.
- Superseding organizer-offer rule: paid publication uses a service-only edition entitlement and atomic RPC. Notification, relay, and station-product clients have no direct mutation grant; public Pro overlays use only the narrow private boolean helper.
- The organizer website-import route is admin-only even though its target event may be organizer-managed. Keep this route behind trusted `app_metadata` admin checks and never authorize LLM reconciliation from client role input.
- `organizer_import_sessions` is service-only workflow state: no client policy is intentional. Both mutation RPCs must remain `SECURITY INVOKER`, revoke `PUBLIC` execution, and validate session expiry/scope plus every JSON key before writing.
- `race_event_edition_sponsors` is also intentionally service-only. Public presentation must pass through the RaceBook gate and expose counted redirect URLs rather than direct destination fields.

## Related Docs

- [RLS Policies](../02-database/rls-policies.md)
- [Race Slug Redirects](../02-database/tables/race-slug-redirects.md)
- [Add RLS Policy](../06-workflows/add-rls-policy.md)
- [Auth Flows](auth-flows.md)
- [Schema Overview](../02-database/schema-overview.md)
- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
