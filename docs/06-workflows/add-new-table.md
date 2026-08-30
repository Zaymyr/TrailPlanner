---
title: Add New Table
scope: workflow
last_verified: 2026-08-30
ai_priority: high
related_files:
  - supabase/migrations
  - supabase/migrations/20260824114439_add_organizer_import_sessions_and_drafts.sql
  - supabase/migrations/20260828161008_add_race_slug_redirects.sql
  - supabase/migrations/20260829080943_update_amazeaunes_2026_final_roadbook.sql
  - supabase/tests/organizer_import_sessions_checks.sql
  - supabase/tests/race_slug_redirects_checks.sql
  - docs/02-database/schema-overview.md
  - docs/02-database/rls-policies.md
related_tables:
  - race_slug_redirects
---

# Add New Table

## Purpose

Use this workflow when adding a Supabase table to Pace Yourself.

For column-only migrations on existing tables, use the relevant table doc plus [../02-database/migrations.md](../02-database/migrations.md) instead; do not create a new table doc unless a new primary table is introduced. Recent examples include organizer edition grouping on `races.edition_group_id` / `series_name` and the checked Plan/RaceBook onboarding statuses on `user_profiles`; both still require schema and business/auth-doc updates. `race_event_update_reads` is the current owner-scoped table example. `organizer_import_sessions` is the service-only example: RLS remains enabled without client policies, every client grant is revoked, service-role grants are explicit, and a SQL check verifies both table and RPC privileges.

Data-only catalog/showcase/roadbook migrations are outside this new-table workflow. They must still be created with the migration CLI, remain idempotent, preserve existing RLS/grants, document any external Storage assets, and update the migration documentation. The Les Amaz’Eaunes 2026 final-roadbook synchronization is the current data-correction example and adds no table.

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

3. Run `npx supabase migration new <descriptive-name>` to create the timestamped migration; do not invent its filename manually.
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
Use `supabase/tests/organizer_import_sessions_checks.sql` for service-only tables and `SECURITY INVOKER` mutation RPCs. Use `supabase/tests/race_slug_redirects_checks.sql` for a public child mapping whose select policy inherits parent visibility while every mutation remains service-only.
The organizer entitlement/payment pair is the current service-only projection-plus-ledger example; its transition SQL check exercises recalculation separately from route/webhook tests.

## Do Not

- Do not add a table without RLS unless it is service-only and documented.
- Do not apply the new-table RLS checklist mechanically to a column-only migration on an existing table; verify the existing row policies still match the new column sensitivity.
- Do not use `user_metadata` for admin authorization.
- Do not update `docs/_archive/db/schema.sql` as current documentation.
- Do not assume columns used in code exist without checking migrations or live schema.
- Do not rely on a service-role route as the only validation for a newly exposed table.
- Do not forget explicit grants for tables accessed through Supabase REST/client APIs; RLS policies alone do not grant table privileges.
- Do not add new grants or policies for a column-only marker when the existing owner-scoped row access remains the intended boundary.
- Do not create a table or migration for a route-only query optimization such as replacing row materialization with a Data API exact count; document the access pattern in the existing schema/table docs instead.
- Do not apply new-table DDL or policy steps to a data-only showcase seed; verify the existing table contracts and public visibility gates instead.
- Do not expose a public redirect/mapping row merely because it exists; reapply all visibility gates of its target parent in RLS and again when loading the canonical resource.

## Related Docs

- [Migrations](../02-database/migrations.md)
- [RLS Checklist](../04-auth-and-security/rls-checklist.md)
- [Add RLS Policy](add-rls-policy.md)
- [Schema Overview](../02-database/schema-overview.md)
- [Race Slug Redirects](../02-database/tables/race-slug-redirects.md)
