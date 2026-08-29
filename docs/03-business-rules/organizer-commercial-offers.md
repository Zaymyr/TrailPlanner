---
title: Organizer Commercial Offers
scope: business-rule
last_verified: 2026-08-29
ai_priority: high
related_files:
  - apps/web/lib/organizer-entitlements.ts
  - apps/web/app/api/organizer/publication-checkout/route.ts
  - apps/web/app/api/stripe/webhook/route.ts
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/dashboard/shell.tsx
  - apps/web/app/admin/_components/AdminOrganizerClaimsTab.tsx
  - apps/web/app/api/admin/event-publication-requests/route.ts
  - supabase/migrations/20260829115507_add_organizer_edition_offers.sql
  - supabase/tests/organizer_edition_entitlements_checks.sql
related_tables:
  - organizer_edition_entitlements
  - organizer_edition_payments
  - race_event_editions
  - race_event_organizers
  - races
---

# Organizer Commercial Offers

## Purpose

The organizer offer is purchased once per event edition. It is independent from participant count and from the runner Premium subscription.

## Key Concepts

- `Visibilité` is free and keeps the event and complete formats in the public catalog.
- `RaceBook` costs 99 € excluding tax and unlocks mobile RaceBook publication.
- `RaceBook Pro` costs 299 € excluding tax and adds notifications, edition duplication, relay management, official aid-station products, and assisted import.
- Upgrading an already active RaceBook edition to Pro costs 200 € excluding tax.
- Every active event organizer inherits the edition entitlement; formats added later are covered automatically.

## Capability Matrix

| Capability | Visibilité | RaceBook | Pro |
| --- | --- | --- | --- |
| Catalog/event/format management | Yes | Yes | Yes |
| Publish or hide RaceBooks | No | Yes | Yes |
| Notify followers and view history/count | No | No | Yes |
| Duplicate an edition | No | No | Yes |
| Manage relay points | No | No | Yes |
| Manage official aid-station products | No | No | Yes |
| Request assisted import | No | No | Yes |

`apps/web/lib/organizer-entitlements.ts` is the central capability resolver. Routes and UI must request a capability rather than compare plan strings locally.

## Stripe Lifecycle

The checkout route accepts only `eventId`, `editionId`, and target `racebook|pro`. After authentication, active membership, edition ownership, and publication-readiness checks, the server selects one configured non-recurring EUR Price with exclusive tax behavior: 99 €, 299 €, or the 200 € upgrade. Stripe Checkout collects billing address and tax id, enables automatic tax and invoice creation, and carries payment/edition/user/tier metadata.

The success URL is not authorization. The dashboard polls its normal organizer event read until the Stripe webhook has marked the transaction paid and recalculated the entitlement.

Any refund, including a partial refund event, or open/lost dispute invalidates its transaction. A dispute later closed as won restores the disputed payment. Refunding an upgrade returns the edition to RaceBook when its base purchase remains paid. Invalidating a RaceBook or direct-Pro purchase returns the edition to Visibilité and hides every attached RaceBook without hiding the catalog formats. Active admin or legacy-admin grants remain authoritative.

## Historical and Admin Rights

The migration grants Pro with source `legacy_admin` to editions that already contained an approved or published RaceBook. Other editions start at Visibilité. The admin Organizer tab can filter effective tiers and set Visibilité, RaceBook, or Pro through an audited admin grant. Historical publication requests remain readable; approving one grants Pro to its edition for compatibility.

## Gotchas

- Never price by participant count or format count.
- Never use a checkout success query parameter as proof of payment.
- Never grant notification, relay, duplication, or official-product access only in the browser; the server route or RLS boundary must enforce it too.
- Do not reuse runner `subscriptions`, RevenueCat, trials, or `premium_grants` for organizer editions.
- Hiding RaceBooks after invalidation must not hide the free catalog entry.

## Related Docs

- [Organizer Race Management](organizer-race-management.md)
- [Stripe](../05-integrations/stripe.md)
- [organizer_edition_entitlements](../02-database/tables/organizer-edition-entitlements.md)
- [organizer_edition_payments](../02-database/tables/organizer-edition-payments.md)
