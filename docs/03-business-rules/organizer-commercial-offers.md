---
title: Organizer Commercial Offers
scope: business-rule
last_verified: 2026-09-08
ai_priority: high
related_files:
  - apps/web/lib/organizer-entitlements.ts
  - apps/web/lib/organizer-modules.ts
  - apps/web/lib/organizer-module-settings.ts
  - apps/web/app/api/organizer/editions/[id]/module-settings/route.ts
  - apps/web/app/api/organizer/publication-checkout/route.ts
  - apps/web/app/api/stripe/webhook/route.ts
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/completion.ts
  - apps/web/app/organizer/_components/dashboard/shell.tsx
  - apps/web/app/admin/_components/AdminOrganizerClaimsTab.tsx
  - apps/web/app/api/admin/event-publication-requests/route.ts
  - apps/web/app/organisateurs/organizer-landing-page.tsx
  - supabase/migrations/20260908093008_add_organizer_offer_modules_v2.sql
  - supabase/tests/organizer_edition_entitlements_checks.sql
  - supabase/tests/organizer_racebook_module_settings_checks.sql
related_tables:
  - organizer_edition_entitlements
  - organizer_edition_payments
  - organizer_racebook_module_settings
  - race_event_editions
---

# Organizer Commercial Offers

## Purpose

One offer is purchased per event edition, independently of participant and format counts. The offer authorizes modules; the organizer then activates only useful modules. Disabling or losing access masks content without deleting it.

## Offers

| Offer | HT per edition | Main rights |
| --- | ---: | --- |
| Visibilité | Free | Public catalog only. |
| Essentiel | 99 € | RaceBook publication, basic equipment/bib/access, simple aid stations. |
| Complet | 199 € | Essential plus advanced fields and per-format overrides, SAS, detailed aid stations, services, awards, notifications and duplication. |
| Signature | 349 € | Complete plus relay, official products, sponsors/clicks, branding and assisted import. |

Direct purchases are 99/199/349 €. Valid upgrades are Essential→Complete 100 €, Essential→Signature 250 € and Complete→Signature 150 €.

## Module Contract

`event` and Course/GPX are permanent. Edition modules are `equipment`, `bib_pickup`, `access`, `services`, `branding`, `sponsors`. Format modules are `aid_stations`, `start_waves`, `awards`, `relay`, `official_products`. Equipment, bib and access format values remain overrides of their edition module.

The states are:

- `active`: enabled by the organizer and allowed by the offer; editable, published and counted in completion;
- `inactive`: allowed but disabled; data retained and excluded from mobile/completion;
- `locked`: outside the effective offer; data retained and shown only as an upsell.

`apps/web/lib/organizer-entitlements.ts` is the capability authority and `apps/web/lib/organizer-modules.ts` is the shared catalog. Server routes must check both capability and effective module state, never compare tier names locally.

## Stripe and Rights Lifecycle

The server chooses one of six explicit one-time EUR Price IDs and validates active status, exact amount, non-recurring mode and exclusive tax behavior. Checkout enables automatic tax, billing address, tax-ID collection and invoice creation. A success redirect is not authorization; the webhook settles the payment and recalculates rights.

Recalculation requires a valid paid path. Refunding/disputing a base purchase invalidates dependent upgrades; invalidating only an upgrade returns to the valid lower tier. Legacy `racebook` payments map to Complete and legacy `pro_direct` or `racebook + pro_upgrade` paths map to Signature. Existing RaceBook/Pro entitlements are upgraded to Complete/Signature. Admin grants remain authoritative.

## Gotchas

- Never delete module content on disable or downgrade.
- Never expose `organizer_racebook_module_settings` directly to clients; mobile receives only an effective boolean map.
- Missing module configuration during rolling deployment uses the historical mobile behavior.
- Automatic Tax still requires the production Stripe account to have the appropriate tax registrations.
- Old clients saving a full `organizer_details` object must not erase protected subtrees.

## Related Docs

- [Organizer Race Management](organizer-race-management.md)
- [Stripe](../05-integrations/stripe.md)
- [organizer_racebook_module_settings](../02-database/tables/organizer-racebook-module-settings.md)
- [organizer_edition_entitlements](../02-database/tables/organizer-edition-entitlements.md)
- [organizer_edition_payments](../02-database/tables/organizer-edition-payments.md)
