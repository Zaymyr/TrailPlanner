---
title: organizer_edition_payments
scope: database
last_verified: 2026-08-29
ai_priority: high
related_files:
  - supabase/migrations/20260829115507_add_organizer_edition_offers.sql
  - apps/web/app/api/organizer/publication-checkout/route.ts
  - apps/web/app/api/stripe/webhook/route.ts
related_tables:
  - organizer_edition_payments
  - organizer_edition_entitlements
  - race_event_editions
---

# `organizer_edition_payments`

## Purpose

Stores organizer Stripe payment attempts and their tax-inclusive settlement values separately from the effective edition right.

## Key Concepts

Purchase kinds are `racebook` (99 € HT), `pro_direct` (299 € HT), and `pro_upgrade` (200 € HT). Only `paid` rows contribute to recalculation.

## Columns

| Column | Type | Rules | Meaning |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key | Payment attempt and Checkout reference. |
| `edition_id` | `uuid` | FK, cascade | Purchased edition. |
| `purchaser_user_id` | `uuid` | nullable Auth FK | Checkout user, retained nullable on Auth deletion. |
| `purchase_kind` | `text` | constrained | Base, direct Pro, or upgrade. |
| `from_tier`, `to_tier` | `text` | constrained | Authorized transition. |
| `status` | `text` | constrained | `pending|paid|failed|expired|refunded|disputed`. |
| Stripe ids and URL | `text` | session/intent unique | Provider reconciliation. |
| subtotal/tax/total | integer | non-negative | Minor currency units. |
| `currency` | `text` | checkout currency | Currently EUR. |
| `paid_at`, `invalidated_at` | `timestamptz` | nullable | Settlement/invalidation times. |
| audit timestamps | `timestamptz` | non-null | Attempt audit. |

## Foreign Keys

- `edition_id -> race_event_editions.id on delete cascade`
- `purchaser_user_id -> auth.users.id on delete set null`

## Indexes

- `(edition_id, created_at desc)` for history.
- PaymentIntent index and unique provider identifiers.
- Partial unique `edition_id` while pending prevents concurrent or incompatible checkouts for the same edition. A repeated request for the same offer reuses the stored Checkout URL when available.

## RLS Policies

RLS is enabled with service-role-only grants. Checkout and webhook routes are the only application writers.

## Business Invariants

- Server code selects the Price and expected amount; clients never supply a Price id or amount.
- Any refund event, including partial, and any open/lost dispute invalidates the complete transaction. A dispute closed as won restores only a row currently marked `disputed`.
- Recalculation uses valid paid transaction combinations and preserves admin overrides.

## Common Queries

```sql
select purchase_kind, status, amount_subtotal, amount_tax, amount_total, currency
from organizer_edition_payments
where edition_id = :edition_id
order by created_at desc;
```

## Gotchas

- A Checkout redirect is not a paid transaction.
- Do not overwrite historical rows to represent another purchase; create another attempt.

## Related Docs

- [organizer_edition_entitlements](organizer-edition-entitlements.md)
- [Stripe](../../05-integrations/stripe.md)
