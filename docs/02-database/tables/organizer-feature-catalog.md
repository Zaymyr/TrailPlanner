---
title: organizer_feature_catalog
scope: database
last_verified: 2026-11-09
ai_priority: high
related_files:
  - supabase/migrations/20261109190500_separate_organizer_invoices_and_feature_grants.sql
  - supabase/migrations/20261109192905_remove_organizer_gift_feature_prices.sql
  - supabase/tests/organizer_manual_invoices_checks.sql
  - apps/web/lib/organizer-features.ts
  - apps/web/lib/organizer-features.test.ts
  - apps/web/lib/organizer-manual-invoices.ts
  - apps/web/app/api/admin/organizer-feature-catalog/route.ts
  - apps/web/app/api/admin/organizer-feature-catalog/route.test.ts
related_tables:
  - organizer_feature_catalog
  - organizer_edition_capability_grants
---

# `organizer_feature_catalog`

## Purpose

Stores the availability and minimum tier of the fourteen individually giftable organizer features. These features are pack exceptions, not products sold a la carte, and have no standalone price.

## Catalog contract

- Eight features require Complet and six require Signature.
- The stable keys and minimum-tier mapping are application allowlists. Admins may update availability, not invent access keys.
- Invoice gift lines carry the feature key and `OFFERT` label without unit price, discount amount or net amount.

## Access

RLS is enabled with no client policy. `anon` and `authenticated` have no privileges; the authenticated admin route uses `service_role` after trusted app-metadata authorization.

## Gotchas

- Do not add prices to this catalog or infer a la carte prices from pack upgrade differences.
- Disabling a catalog row prevents future invoice selection but does not revoke an existing edition grant.

## Related Docs

- [organizer_invoices](organizer-invoices.md)
- [organizer_edition_capability_grants](organizer-edition-capability-grants.md)
