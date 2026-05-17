---
title: RLS Checklist
scope: auth
last_verified: 2026-05-17
ai_priority: high
related_files:
  - supabase/migrations
  - supabase/tests/coach_rls_checks.sql
  - apps/web/lib/supabase.ts
  - apps/web/lib/http.ts
related_tables:
  - race_plans
  - user_profiles
  - subscriptions
  - premium_grants
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

- `supabase/tests/coach_rls_checks.sql` as a pattern for manual RLS context checks;
- app route tests when policy behavior is exercised through Next.js APIs;
- SQL editor/psql sessions with `set local role authenticated` and `request.jwt.claim.sub` for manual checks.

## Gotchas

- Service role bypasses RLS, so passing a service-route test does not prove client RLS works.
- `anon` grants are intentional for anonymous Supabase users only when policies still bind to `auth.uid()`.
- Coach policies must require an active coach relationship.
- Archived schema docs may show stale policy names.

## Related Docs

- [RLS Policies](../02-database/rls-policies.md)
- [Add RLS Policy](../06-workflows/add-rls-policy.md)
- [Auth Flows](auth-flows.md)
- [Schema Overview](../02-database/schema-overview.md)
