---
title: organizer_edition_entitlements
scope: database
last_verified: 2026-08-29
ai_priority: high
related_files:
  - supabase/migrations/20260829115507_add_organizer_edition_offers.sql
  - apps/web/lib/organizer-entitlements.ts
related_tables:
  - organizer_edition_entitlements
  - organizer_edition_payments
  - race_event_editions
---

# `organizer_edition_entitlements`

## Purpose

Stores the effective commercial tier for one event edition.

## Key Concepts

The row is edition-scoped, while human access remains event-scoped through `race_event_organizers`. Stripe transactions are stored separately and recalculated into this current projection.

## Columns

| Column | Type | Rules | Meaning |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key | Entitlement id. |
| `edition_id` | `uuid` | unique FK, cascade | Covered edition. |
| `tier` | `text` | `visibility|racebook|pro` | Effective offer. |
| `source` | `text` | `system|stripe|admin|legacy_admin` | Activation authority. |
| `status` | `text` | `active|revoked` | Current row status. |
| `activated_at`, `revoked_at` | `timestamptz` | nullable | Lifecycle timestamps. |
| `granted_by` | `uuid` | nullable Auth FK | Admin actor for manual rights. |
| audit timestamps | `timestamptz` | non-null | Creation/update audit. |

## Foreign Keys

- `edition_id -> race_event_editions.id on delete cascade`
- `granted_by -> auth.users.id on delete set null`

## Indexes

The unique `edition_id` constraint provides the effective-right lookup.

## RLS Policies

RLS is enabled with no client grants. Only service role can read or mutate rows. The narrow private `organizer_edition_is_pro(uuid)` function exposes only a boolean for public relay/product RLS.

## Business Invariants

- Every newly inserted edition receives a Visibilité row through a trigger.
- Active admin and legacy-admin sources override Stripe recalculation.
- Returning to Visibilité hides attached RaceBooks but does not change catalog visibility.
- Legacy approved/published editions are backfilled Pro.

## Common Queries

```sql
select tier, source, status
from organizer_edition_entitlements
where edition_id = :edition_id;
```

## Gotchas

- This table is a projection, not payment history.
- Do not grant direct client select merely to render the dashboard; organizer APIs return the authorized edition projection.

## Related Docs

- [organizer_edition_payments](organizer-edition-payments.md)
- [Organizer Commercial Offers](../../03-business-rules/organizer-commercial-offers.md)

