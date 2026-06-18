---
title: Add New Table
scope: workflow
last_verified: 2026-06-18
ai_priority: high
related_files:
  - supabase/migrations
  - docs/02-database/schema-overview.md
  - docs/02-database/rls-policies.md
related_tables: []
---

# Add New Table

## Purpose

Use this workflow when adding a Supabase table to Pace Yourself.

## Key Concepts

- Migration: timestamped SQL file in `supabase/migrations`.
- RLS: row-level security required for app tables.
- Grants: SQL privileges required for PostgREST/Supabase Data API access in addition to RLS.
- Table doc: docs file updated with schema and invariants.

## Steps

1. Read [../02-database/schema-overview.md](../02-database/schema-overview.md) and [../02-database/rls-policies.md](../02-database/rls-policies.md).
2. Search existing migrations:

```bash
rg -n "create table|alter table|create policy" supabase/migrations
```

3. Create a timestamped migration in `supabase/migrations`.
4. Define columns, constraints, defaults, indexes, triggers, and comments if useful.
5. Enable RLS in the same migration.
6. Add policies for every intended client operation.
7. Grant role privileges only when the RLS policy should be reachable. Keep `anon` ungranted for secret-link or service-mediated tables.
8. Add a table doc under `docs/02-database/tables/` if it is a primary domain table.
9. Update [../02-database/schema-overview.md](../02-database/schema-overview.md) and [../02-database/relationships.md](../02-database/relationships.md).
10. If the table introduces a new business rule, add or update the matching doc under `docs/03-business-rules/`.

## Validation

Run targeted tests or type checks for changed app code:

```bash
npm run typecheck
npm run test
```

If the policy is complex, add a manual SQL check under `supabase/tests/`.
Use `supabase/tests/organizer_rls_checks.sql` as the event-membership example.

## Do Not

- Do not add a table without RLS unless it is service-only and documented.
- Do not use `user_metadata` for admin authorization.
- Do not update `docs/_archive/db/schema.sql` as current documentation.
- Do not assume columns used in code exist without checking migrations or live schema.
- Do not rely on a service-role route as the only validation for a newly exposed table.
- Do not forget explicit grants for tables accessed through Supabase REST/client APIs; RLS policies alone do not grant table privileges.

## Related Docs

- [Migrations](../02-database/migrations.md)
- [RLS Checklist](../04-auth-and-security/rls-checklist.md)
- [Add RLS Policy](add-rls-policy.md)
- [Schema Overview](../02-database/schema-overview.md)
