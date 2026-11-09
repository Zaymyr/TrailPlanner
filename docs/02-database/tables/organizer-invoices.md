---
title: organizer_invoices
scope: database
last_verified: 2026-11-09
ai_priority: high
related_files:
  - supabase/migrations/20261109190500_separate_organizer_invoices_and_feature_grants.sql
  - supabase/tests/organizer_manual_invoices_checks.sql
  - apps/web/lib/organizer-manual-invoices.ts
  - apps/web/lib/organizer-invoice-document.ts
  - apps/web/app/api/admin/organizer-invoices/route.ts
  - apps/web/app/api/admin/organizer-invoices/preview/route.ts
  - apps/web/app/api/admin/organizer-invoices/[invoiceId]/settlement/route.ts
  - apps/web/app/api/admin/organizer-invoices/[invoiceId]/download/route.ts
  - apps/web/app/api/admin/organizer-invoices/[invoiceId]/pdf/route.ts
  - apps/web/app/api/organizer/invoices/route.ts
  - apps/web/app/api/organizer/invoices/[paymentId]/download/route.ts
related_tables:
  - organizer_invoices
  - race_event_editions
---

# `organizer_invoices`

## Purpose

Stores issued manual organizer invoices independently from payment attempts and edition rights. Issuing, correcting or settling a row never grants or revokes an organizer entitlement.

## Contract

- Numbers use the shared chronological `PY-YYYY-NNNNNN` sequence. Allocation holds a transaction advisory lock and considers legacy numbered payment rows.
- Legal facts, dates, amounts and the JSON snapshot are immutable after issuance. PDF attachment metadata can be repaired.
- An unpaid active invoice may be corrected only by issuing a new numbered `corrective` row. The original becomes `replaced` and remains downloadable.
- `paid_at`/`paid_by` record one complete bank-transfer settlement. Zero-net invoices have no settlement and display “Aucun montant à régler”.
- `due_date`, `service_date`, `original_subtotal`, `discount_total` and `net_total` are explicit server-validated facts. `net_total = original_subtotal - discount_total`.
- RLS is enabled with no client policy. Only `service_role` can read or mutate rows; application routes authorize admins or active event organizers before returning DTOs or signed URLs.

## Gotchas

- Do not mutate a numbered row to implement editing. Use `issue_admin_organizer_invoice` with `p_replaces_invoice_id`.
- Do not call entitlement recalculation after issuing or settling a manual invoice.
- Legacy generated/uploaded invoices remain on `organizer_edition_payments`; list and download routes normalize both stores.

## Related Docs

- [Organizer Commercial Offers](../../03-business-rules/organizer-commercial-offers.md)
- [organizer_edition_payments](organizer-edition-payments.md)
- [organizer_feature_catalog](organizer-feature-catalog.md)
