---
title: organizer_edition_payments
scope: database
last_verified: 2026-09-10
ai_priority: high
related_files:
  - supabase/migrations/20260829115507_add_organizer_edition_offers.sql
  - supabase/migrations/20260908093008_add_organizer_offer_modules_v2.sql
  - apps/web/app/api/organizer/publication-checkout/route.ts
  - apps/web/lib/organizer-publication-tier.ts
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

Current purchase kinds are `essential_direct`, `complete_direct`, `signature_direct`, `essential_to_complete`, `essential_to_signature` and `complete_to_signature`. Legacy kinds remain valid history. Only `paid` rows on a complete base/upgrade path contribute to recalculation.

## Columns

| Column | Type | Rules | Meaning |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key | Payment attempt and Checkout reference. |
| `edition_id` | `uuid` | FK, cascade | Purchased edition. |
| `purchaser_user_id` | `uuid` | nullable Auth FK | Checkout user, retained nullable on Auth deletion. |
| `purchase_kind` | `text` | constrained | Direct purchase or an explicit tier-to-tier upgrade. |
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
- Checkout recomputes the populated-module publication requirement server-side and records it in Stripe metadata; it does not create extra entitlement rows for private draft access. When checkout started from `Publier`, its success URL also carries a non-authoritative publication intent: the dashboard waits for webhook-confirmed entitlement, then calls the protected edition publication route for preview-selected formats.
- Any refund event, including partial, and any open/lost dispute invalidates the complete transaction. A dispute closed as won restores only a row currently marked `disputed`.
- Recalculation uses valid paid transaction paths, so a refunded/disputed base invalidates its dependent upgrade, and preserves admin overrides.

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
