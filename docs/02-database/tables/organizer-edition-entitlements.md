---
title: organizer_edition_entitlements
scope: database
last_verified: 2026-09-11
ai_priority: high
related_files:
  - supabase/migrations/20260829115507_add_organizer_edition_offers.sql
  - supabase/migrations/20260829204139_ensure_race_event_editions_for_formats.sql
  - supabase/migrations/20260908093008_add_organizer_offer_modules_v2.sql
  - supabase/migrations/20260911073318_add_organizer_manual_payments_and_invoices.sql
  - supabase/migrations/20260911093649_add_organizer_publication_grant_origin.sql
  - supabase/migrations/20260911110037_fix_organizer_publication_and_manual_payment_consistency.sql
  - supabase/tests/organizer_edition_entitlements_checks.sql
  - apps/web/lib/organizer-entitlements.ts
  - apps/web/app/api/organizer/editions/[id]/branding/route.ts
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
| `tier` | `text` | `visibility|essential|complete|signature` | Effective offer. |
| `source` | `text` | `system|stripe|manual_payment|admin|complimentary|legacy_admin` | Effective publication origin. |
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
- The canonical-edition repair creates missing edition rows before attaching dated formats, so the existing entitlement trigger also initializes their Visibilité projection.
- Active operational admin, explicit complimentary, and legacy-admin sources override paid-ledger recalculation until explicitly changed or converted into a real manual purchase.
- Recalculation marks the effective paid tier `stripe` or `manual_payment` from the decisive paid transaction's channel.
- `set_admin_organizer_edition_grant` can change Admin/Offert grants directly, but accepts Stripe or virement only when the requested tier and channel are backed by the valid payment ledger.
- Returning to Visibilité hides attached RaceBooks but does not change catalog visibility.
- A direct bank transfer may replace a higher operational Admin/Offert grant with the lower tier actually purchased; paid-ledger rights still reject downgrade purchases.
- Legacy RaceBook and Pro editions are mapped to Complete and Signature without charge.
- `branding.manage` is granted only by an active Signature entitlement and controls publication of the branding snapshot. Membership still permits reading and editing the private draft; a downgrade masks the published identity and preserves both snapshots.

## Common Queries

```sql
select tier, source, status
from organizer_edition_entitlements
where edition_id = :edition_id;
```

## Gotchas

- This table is a projection, not payment history.
- Do not grant direct client select merely to render the dashboard; organizer APIs return the authorized edition projection.
- Enforce branding publication in the server route; draft authoring uses event membership and the selected module, while runner visibility remains a separate effective-entitlement contract.

## Related Docs

- [organizer_edition_payments](organizer-edition-payments.md)
- [Organizer Commercial Offers](../../03-business-rules/organizer-commercial-offers.md)
