---
title: Add RLS Policy
scope: workflow
last_verified: 2026-08-29
ai_priority: high
related_files:
  - supabase/migrations
  - supabase/migrations/20260824114439_add_organizer_import_sessions_and_drafts.sql
  - supabase/migrations/20260828161008_add_race_slug_redirects.sql
  - supabase/migrations/20260829080943_update_amazeaunes_2026_final_roadbook.sql
  - supabase/tests/organizer_rls_checks.sql
  - supabase/tests/organizer_import_sessions_checks.sql
  - supabase/tests/race_slug_redirects_checks.sql
  - apps/web/lib/supabase.ts
related_tables:
  - race_slug_redirects
---

# Add RLS Policy

## Purpose

Use this workflow when adding or changing row-level security policies.

For column-only migrations on existing RLS-protected tables, first verify that the existing row policies cover the new data sensitivity. Add or change policies only when the new column changes who should be able to read or mutate the row. The organizer edition-grouping columns on `races` and the owner-only `user_profiles.onboarding_completed_at` marker are current examples that required verification but no new policy.

The same rule applies to data-only showcase seeds and final-roadbook corrections: do not add a policy merely because rows are inserted or updated. Verify that the affected rows satisfy the existing visibility predicates and that no draft-only organizer detail becomes reachable unintentionally. The Les Amaz’Eaunes 2026 synchronization changes no grants, policies, ownership, or publication state.

## Key Concepts

- Owner check: `auth.uid() = user_id`.
- Parent check: `exists` query through a parent table.
- Admin check: trusted app metadata or server-side role check.
- Service role: server-only bypass for trusted operations.
- Secret-link access: public viewers resolve unguessable tokens through server code; table rows still use owner RLS.
- Public child mapping: a directly readable row whose policy repeats every public visibility gate of its parent resource.

## Steps

1. Read [../02-database/rls-policies.md](../02-database/rls-policies.md).
2. Identify the table access model: owner, parent-owned, public catalog, admin, or service-only.
3. Locate existing policies:

```bash
rg -n "create policy|drop policy|enable row level security" supabase/migrations
```

4. Write a migration that drops/recreates or adds the policy explicitly.
5. For owner policies, use `auth.uid()`.
6. For admin checks, use `app_metadata` or a server/profile role pattern.
7. Add `with check` for insert/update policies.
8. Add or update a manual SQL check when the policy has relationship logic.
9. Update [../02-database/rls-policies.md](../02-database/rls-policies.md).

## Validation

Manual RLS context pattern:

```sql
begin;
set local role authenticated;
set local request.jwt.claim.sub = '<user-id>';
select * from public.some_table;
rollback;
```

Use `supabase/tests/organizer_rls_checks.sql` as the event-membership example for relationship-based policy checks. It also covers owner-scoped favorites, format/event consistency on updates, live-event visibility, and owner-only read receipts.
Use `supabase/tests/organizer_import_sessions_checks.sql` when the intended design is a service-only table with RLS enabled, no client policy, revoked client grants, and narrowly granted invoker RPCs.
Use `supabase/tests/race_slug_redirects_checks.sql` when a public child mapping needs explicit anon/authenticated select grants, parent-visibility RLS, and service-only mutation functions.

## Do Not

- Do not use `user_metadata` for new auth decisions.
- Do not rely on service-role route behavior to prove RLS works.
- Do not leave a table with RLS enabled but no reachable select policy unless it is intentionally write-only/service-only.
- Do not forget SQL grants; a policy does not grant `select`, `insert`, `update`, or `delete` privileges by itself.
- Do not grant `anon` to secret-link tables unless public direct table access is explicitly intended and documented.
- Do not add separate policies for columns such as organizer detail JSONB when row-level access on the existing table is still the intended boundary.
- Do not add a separate policy for owner-only profile markers such as `onboarding_completed_at`; preserve the existing profile row ownership boundary.
- Do not weaken catalog or Racebook policies to expose demo rows; seed only rows that deliberately satisfy the existing public/live/approval gates.
- Do not treat a redirect/mapping row as independent public authority. A hidden target or hidden parent must make the mapping unreadable, and application code must revalidate the target before responding.

## Related Docs

- [RLS Policies](../02-database/rls-policies.md)
- [RLS Checklist](../04-auth-and-security/rls-checklist.md)
- [Add New Table](add-new-table.md)
- [Debug Supabase Auth](debug-supabase-auth.md)
- [Race Slug Redirects](../02-database/tables/race-slug-redirects.md)
