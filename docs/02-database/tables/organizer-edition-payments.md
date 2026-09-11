---
title: organizer_edition_payments
scope: database
last_verified: 2026-09-11
ai_priority: high
related_files:
  - supabase/migrations/20260829115507_add_organizer_edition_offers.sql
  - supabase/migrations/20260908093008_add_organizer_offer_modules_v2.sql
  - apps/web/app/api/organizer/publication-checkout/route.ts
  - apps/web/lib/organizer-publication-tier.ts
  - apps/web/lib/organizer-publication-tier.test.ts
  - apps/web/app/api/stripe/webhook/route.ts
  - apps/web/app/api/admin/organizer-payments/route.ts
  - apps/web/app/api/admin/organizer-payments/[paymentId]/invoice/route.ts
  - apps/web/app/api/organizer/invoices/route.ts
  - apps/web/app/api/organizer/invoices/[paymentId]/download/route.ts
  - apps/web/lib/organizer-payments.ts
  - apps/web/lib/organizer-invoices.ts
  - supabase/migrations/20260911073318_add_organizer_manual_payments_and_invoices.sql
  - supabase/migrations/20260911093649_add_organizer_publication_grant_origin.sql
  - supabase/migrations/20260911110037_fix_organizer_publication_and_manual_payment_consistency.sql
related_tables:
  - organizer_edition_payments
  - organizer_edition_entitlements
  - race_event_editions
---

# `organizer_edition_payments`

## Purpose

Stores Stripe attempts and paid bank transfers, with their tax-inclusive settlement values and invoice references, separately from the effective edition right.

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
| `payment_channel` | `text` | `stripe|bank_transfer`, default `stripe` | Commercial channel shown to organizers; the default keeps historical rows compatible. |
| `recorded_by` | `uuid` | nullable Auth FK | Admin who recorded a bank transfer. |
| Stripe ids and URL | `text` | session/intent unique | Provider reconciliation. |
| `stripe_invoice_id` | `text` | nullable, unique when present | Stripe Invoice resolved by webhook or lazily from the Checkout Session. |
| subtotal/tax/total | integer | non-negative | Minor currency units. |
| `currency` | `text` | checkout currency | Currently EUR. |
| `paid_at`, `invalidated_at` | `timestamptz` | nullable | Settlement/invalidation times. |
| invoice path/name/upload audit | mixed | all present or all null | Private manual PDF reference, original file name, upload time, and uploader. |
| audit timestamps | `timestamptz` | non-null | Attempt audit. |

## Foreign Keys

- `edition_id -> race_event_editions.id on delete cascade`
- `purchaser_user_id -> auth.users.id on delete set null`

## Indexes

- `(edition_id, created_at desc)` for history.
- PaymentIntent index and unique provider identifiers.
- Partial unique `edition_id` while pending prevents concurrent or incompatible checkouts for the same edition. A repeated request for the same offer reuses the stored Checkout URL when available.

## RLS Policies

RLS is enabled with service-role-only grants. Checkout, webhook, and authenticated admin payment routes are the only application writers. The private `organizer-invoices` bucket has no client policy; manual downloads are issued only as 60-second signed URLs after active event-membership verification.

## Business Invariants

- Server code selects the Price and expected amount; clients never supply a Price id or amount.
- Checkout recomputes the populated-module publication requirement server-side and records it in Stripe metadata; it does not create extra entitlement rows for private draft access. When checkout started from `Publier`, its success URL also carries a non-authoritative publication intent: the dashboard waits for webhook-confirmed entitlement, then calls the protected edition publication route for preview-selected formats.
- Existence probes used by that recomputation parse only the response array and select an actual table column; edition branding must project its `edition_id` primary key rather than a nonexistent `id`.
- Any refund event, including partial, and any open/lost dispute invalidates the complete transaction. A dispute closed as won restores only a row currently marked `disputed`.
- Recalculation uses valid paid transaction paths, so a refunded/disputed base invalidates its dependent upgrade, and preserves admin overrides.
- The protected admin route accepts only Essentiel, Complet, or Signature plus a non-future calendar date. It derives 99/199/349 € HT and 20% VAT from the selected direct pack, uses midnight UTC for the settlement date, and calls `record_admin_organizer_bank_transfer`; the function validates the minor-unit amounts, calculates TTC, inserts a paid ledger row, and recalculates the entitlement atomically.
- A bank transfer cannot duplicate or downgrade a ledger-backed paid tier. An `admin`, `complimentary`, or `legacy_admin` override is not payment history: a newly received transfer may replace it with the selected paid tier, even when that paid tier is lower than the temporary grant.
- Never trust browser-supplied settlement amounts for a direct pack. The admin route is the canonical pricing boundary and recomputes HT/TVA before invoking the service-role-only function.
- Choosing Stripe or virement as the admin-visible publication origin never creates synthetic payment history; the requested tier and channel must already resolve from valid paid ledger rows.
- Replacing a manual invoice changes only its file metadata. The transaction remains historical; the old object is removed after the new ledger reference is stored.

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
- Never return Stripe identifiers or private Storage paths in organizer DTOs.

## Related Docs

- [organizer_edition_entitlements](organizer-edition-entitlements.md)
- [Stripe](../../05-integrations/stripe.md)
