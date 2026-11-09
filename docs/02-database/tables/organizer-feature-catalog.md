---
title: organizer_feature_catalog
scope: database
last_verified: 2026-11-09
ai_priority: high
related_files:
  - supabase/migrations/20261109190500_separate_organizer_invoices_and_feature_grants.sql
  - supabase/tests/organizer_manual_invoices_checks.sql
  - apps/web/lib/organizer-features.ts
  - apps/web/lib/organizer-features.test.ts
  - apps/web/lib/organizer-manual-invoices.ts
  - apps/web/app/api/admin/organizer-feature-catalog/route.ts
related_tables:
  - organizer_feature_catalog
  - organizer_edition_capability_grants
---

# `organizer_feature_catalog`

## Purpose

Stores the current EUR list price and availability of the fourteen individually giftable organizer features. Invoice snapshots retain the price used at issuance, so later catalog edits never rewrite history.

## Initial pricing

- Eight Complet features cost 1,250 cents each, totaling the 100 € Essentiel→Complet difference.
- Six Signature features cost 2,500 cents each, totaling the 150 € Complet→Signature difference.
- The stable keys and minimum-tier mapping are application allowlists. Admins may update price and active state, not invent access keys.

## Access

RLS is enabled with no client policy. `anon` and `authenticated` have no privileges; the authenticated admin route uses `service_role` after trusted app-metadata authorization.

## Gotchas

- Browser-supplied option prices are never accepted during preview or issuance.
- Disabling a catalog row prevents future invoice selection but does not revoke an existing edition grant.

## Related Docs

- [organizer_invoices](organizer-invoices.md)
- [organizer_edition_capability_grants](organizer-edition-capability-grants.md)
