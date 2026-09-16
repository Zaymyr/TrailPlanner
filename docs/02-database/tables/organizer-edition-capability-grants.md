---
title: organizer_edition_capability_grants
scope: database
last_verified: 2026-09-16
ai_priority: high
related_files:
  - supabase/migrations/20260915104528_add_organizer_edition_capability_grants.sql
  - supabase/tests/organizer_edition_capability_grants_checks.sql
  - apps/web/lib/organizer-entitlements.ts
  - apps/web/lib/organizer-entitlements.test.ts
related_tables:
  - organizer_edition_capability_grants
  - organizer_edition_entitlements
  - race_event_editions
---

# `organizer_edition_capability_grants`

## Purpose

Stores edition-scoped complimentary module access that supplements the commercial organizer pack without changing it.

## Key Concepts

The table is a current-state projection, not an append-only history. An active grant unlocks one supported capability independently from `organizer_edition_entitlements`; revocation keeps the row and both grant/revoke audit facts. Changing the edition pack never deletes or rewrites this projection. Repeating the same activation or revocation is idempotent and preserves the original actor and timestamp; revoking a capability that was never granted creates no row.

## Columns

| Column | Type | Rules | Meaning |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key | Grant id. |
| `edition_id` | `uuid` | non-null FK, unique with capability | Covered event edition. |
| `capability_key` | `text` | `racebook_analytics.view` | Supported complimentary module. |
| `status` | `text` | `active\|revoked` | Current grant state. |
| `granted_by`, `revoked_by` | `uuid` | nullable Auth FKs | Admin actors; deletion preserves the audit timestamps. |
| `granted_at`, `revoked_at` | `timestamptz` | lifecycle-constrained | Activation and revocation timestamps. |
| `created_at`, `updated_at` | `timestamptz` | non-null | Projection audit timestamps. |

## Foreign Keys

- `edition_id -> race_event_editions.id on delete cascade`
- `granted_by -> auth.users.id on delete set null`
- `revoked_by -> auth.users.id on delete set null`

## Indexes

- Unique `(edition_id, capability_key)` keeps one current lifecycle per edition/module.
- Partial indexes on `granted_by` and `revoked_by` support Auth-user deletion and attribution lookups.

## RLS Policies

RLS is enabled with no client policy. `PUBLIC`, `anon`, and `authenticated` privileges are revoked; `service_role` alone can read or mutate the table. `set_admin_organizer_edition_capability_grant` is `SECURITY INVOKER`, executable only by `service_role`, and is called only after trusted route-level admin authorization.

## Business Invariants

- Only `racebook_analytics.view` can be stored in V1.
- Active rows require `granted_at` and cannot retain revocation fields.
- Revoked rows require `revoked_at`; prior grant attribution is retained when an active row is revoked.
- Regranting resets the revoke fields and records the new granting actor/time.
- Signature grants analytics through its tier. A lower tier needs an active complimentary row; the row itself never upgrades or downgrades the pack.

## Common Queries

```sql
select capability_key, status, granted_at, revoked_at
from public.organizer_edition_capability_grants
where edition_id = :edition_id;
```

## Gotchas

- Do not expose this table directly to organizers. Server routes combine it with the pack entitlement and return a bounded effective-capability DTO.
- Revocation is an update to `status`, not deletion.
- Adding another capability requires coordinated SQL allowlist, TypeScript schema, tests, and offer documentation changes.
- Keep the RPC's target-status `CASE` parenthesized inside its PL/pgSQL `IF` condition; otherwise PostgreSQL can parse the inner `THEN` as the procedural delimiter.

## Related Docs

- [organizer_edition_entitlements](organizer-edition-entitlements.md)
- [Organizer Commercial Offers](../../03-business-rules/organizer-commercial-offers.md)
- [RLS Policies](../rls-policies.md)
