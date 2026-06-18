---
title: Add RLS Policy
scope: workflow
last_verified: 2026-06-18
ai_priority: high
related_files:
  - supabase/migrations
  - supabase/tests/organizer_rls_checks.sql
  - apps/web/lib/supabase.ts
related_tables: []
---

# Add RLS Policy

## Purpose

Use this workflow when adding or changing row-level security policies.

## Key Concepts

- Owner check: `auth.uid() = user_id`.
- Parent check: `exists` query through a parent table.
- Admin check: trusted app metadata or server-side role check.
- Service role: server-only bypass for trusted operations.
- Secret-link access: public viewers resolve unguessable tokens through server code; table rows still use owner RLS.

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

Use `supabase/tests/organizer_rls_checks.sql` as the event-membership example for relationship-based policy checks.

## Do Not

- Do not use `user_metadata` for new auth decisions.
- Do not rely on service-role route behavior to prove RLS works.
- Do not leave a table with RLS enabled but no reachable select policy unless it is intentionally write-only/service-only.
- Do not forget SQL grants; a policy does not grant `select`, `insert`, `update`, or `delete` privileges by itself.
- Do not grant `anon` to secret-link tables unless public direct table access is explicitly intended and documented.

## Related Docs

- [RLS Policies](../02-database/rls-policies.md)
- [RLS Checklist](../04-auth-and-security/rls-checklist.md)
- [Add New Table](add-new-table.md)
- [Debug Supabase Auth](debug-supabase-auth.md)
