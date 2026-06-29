---
title: RLS Checklist
scope: auth
last_verified: 2026-06-29
ai_priority: high
related_files:
  - supabase/migrations
  - supabase/migrations/20260618160000_add_organizer_dashboard_details.sql
  - supabase/tests/organizer_rls_checks.sql
  - apps/web/lib/supabase.ts
  - apps/web/lib/http.ts
  - apps/web/app/api/plan-shares/route.ts
  - apps/web/app/api/plan-shares/crew-state/route.ts
related_tables:
  - race_plans
  - plan_share_links
  - races
  - race_events
  - race_aid_stations
  - user_profiles
  - subscriptions
  - premium_grants
  - race_event_claims
  - race_event_organizers
  - race_aid_station_products
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
11. When adding columns to an existing RLS-protected table, confirm the existing row policies still match the new data sensitivity.

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
- `supabase/tests/organizer_rls_checks.sql` for event-membership, race-event favorites, and organizer update visibility checks;
- app route tests when policy behavior is exercised through Next.js APIs;
- SQL editor/psql sessions with `set local role authenticated` and `request.jwt.claim.sub` for manual checks.

## Gotchas

- Service role bypasses RLS, so passing a service-route test does not prove client RLS works.
- `anon` grants are intentional for anonymous Supabase users only when policies still bind to `auth.uid()`.
- Archived schema docs may show stale policy names.
- Avoid overloading owner columns for presentation metadata. For example, `products.is_official` is the official/shared catalog flag; `products.created_by` remains ownership only.
- Data-only official product imports that only upsert `products` rows can reuse existing product RLS policies; changing grants, views, functions, or ownership semantics requires the full checklist.
- Data-only official product image backfills can reuse existing product RLS policies when they only update `products.image_url` and keep ownership, grants, and visibility unchanged.
- Event-scoped organizer policies need both claim/member RLS and route-level service-role authorization checks. Service-role route success alone does not prove direct RLS behavior.
- New service flags on `race_aid_stations` reuse the existing station row policies; do not add separate grants for them.
- New organizer JSONB columns on existing source tables reuse their table row policies; do not add separate grants or bypass active `race_event_organizers` checks for them.
- Secret-link tables such as `plan_share_links` still need owner RLS. Public viewers should resolve unguessable tokens through server/service-role code, not direct `anon` table grants.
- Re-sharing a plan can update an existing `plan_share_links` snapshot, so the service route must verify both bearer-token identity and parent-plan ownership before update as well as insert.
- Public crew-state updates for `plan_share_links` are allowed only through a token-hash service route and should remain limited to `departure_time` and `crew_state`.

## Related Docs

- [RLS Policies](../02-database/rls-policies.md)
- [Add RLS Policy](../06-workflows/add-rls-policy.md)
- [Auth Flows](auth-flows.md)
- [Schema Overview](../02-database/schema-overview.md)
- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
