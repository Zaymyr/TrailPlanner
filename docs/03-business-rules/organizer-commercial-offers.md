---
title: Organizer Commercial Offers
scope: business-rule
last_verified: 2026-09-10
ai_priority: high
related_files:
  - apps/web/lib/organizer-entitlements.ts
  - apps/web/lib/organizer-modules.ts
  - apps/web/lib/organizer-module-settings.ts
  - apps/web/lib/organizer-publication-tier.ts
  - apps/web/app/api/organizer/editions/[id]/module-settings/route.ts
  - apps/web/app/api/organizer/publication-checkout/route.ts
  - apps/web/app/api/stripe/webhook/route.ts
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/completion.ts
  - apps/web/app/organizer/_components/dashboard/shell.tsx
  - apps/web/playwright.organizer.config.ts
  - apps/web/e2e/organizer-payment.spec.ts
  - apps/web/app/admin/_components/AdminOrganizerClaimsTab.tsx
  - apps/web/app/api/admin/event-publication-requests/route.ts
  - apps/web/app/organisateurs/organizer-landing-page.tsx
  - apps/web/app/organisateurs/organizer-landing-page.test.ts
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

One offer is purchased per event edition, independently of participant and format counts. Event membership authorizes every draft editor; the offer authorizes public output and costly operations. Disabling or losing publication access masks content without deleting it.

The public `/organisateurs` page presents these edition offers alongside a separate Google Play CTA for inspecting the Trail TST example in the runner app. That demonstration path does not create an organizer entitlement or start a checkout.

## Offers

| Offer | HT per edition | Main rights |
| --- | ---: | --- |
| Visibilité | Free | Public catalog only. |
| Essentiel | 99 € | RaceBook publication, basic equipment/bib/access, simple aid stations. |
| Complet | 199 € | Essential plus advanced fields and per-format overrides, SAS, detailed aid stations, services, awards, notifications and duplication. |
| Signature | 349 € | Complete plus relay, official products, sponsors/clicks, branding and assisted import. |

Direct purchases are 99/199/349 €. Valid upgrades are Essential→Complete 100 €, Essential→Signature 250 € and Complete→Signature 150 €.

## Module Contract

`event` and Course/GPX are permanent. Edition modules are `equipment`, `bib_pickup`, `access`, `services`, `branding`, `sponsors`. Format modules are `aid_stations`, `start_waves`, `awards`, `relay`, `official_products`. Equipment, bib and access format overrides are centralized advanced groups requiring Complet; the editor marks them once with `Options avancées · Complet` instead of adding field badges.

The states are:

- `active`: enabled by the organizer and allowed by the offer; editable and publishable;
- `inactive`: disabled by the organizer; data retained and excluded from mobile/completion;
- `draftOnly`: enabled and editable, but above the current offer; data retained and excluded from every runner-facing response.

`apps/web/lib/organizer-entitlements.ts` is the publication/operation capability authority and `apps/web/lib/organizer-modules.ts` is the shared minimum-tier catalog. Organizer content routes use membership plus the selected module for authoring. Public reads and costly actions continue to require their effective capability. Draft access never creates an entitlement.

The web section chooser separates edition-common modules from per-format modules before batching local switch drafts into one typed module-settings PATCH. On the event tab, format-scoped changes target all existing formats and mixed values are labelled; on a format tab they target only the active format. Until the PATCH succeeds, the active dashboard navigation and completion use the last persisted configuration; failures keep the draft available for retry, and closing a modified regular chooser requires explicit discard confirmation.

Completion percentages count required modules only. Recommended and optional tiles keep their own empty/incomplete/complete status without lowering the bars. Event equipment is optional; inherited format equipment is optional too. Checking a format-specific equipment override makes that format tile required until its list contains at least one item, while free-text notes never satisfy that conditional requirement.

## Stripe and Rights Lifecycle

The server chooses one of six explicit one-time EUR Price IDs and validates active status, exact amount, non-recurring mode and exclusive tax behavior. Checkout enables automatic tax, billing address, tax-ID collection and invoice creation. A success redirect is not authorization; the webhook settles the payment and recalculates rights.

The dashboard recommends the highest tier used by selected, populated sections. Its publication dialog states which content will publish and which will remain private for a lower choice. Checkout and RaceBook publication independently recompute the persisted requirement; choosing a lower valid paid offer never deletes excluded drafts. Each format now has one three-state selector backed by the existing booleans: `Masqué` clears preview and live, `Privé` enables preview and clears live, and `Public` enables both only after the server verifies readiness and the edition entitlement. The primary publication CTA still publishes every selected complete format atomically, and a publication checkout carries that intent through the webhook-confirmed return. The opt-in Playwright payment journey uses Stripe test mode only, waits for webhook-confirmed Essential access, and deletes its uniquely named `TEST` event in a `finally` cleanup.

Recalculation requires a valid paid path. Refunding/disputing a base purchase invalidates dependent upgrades; invalidating only an upgrade returns to the valid lower tier. Legacy `racebook` payments map to Complete and legacy `pro_direct` or `racebook + pro_upgrade` paths map to Signature. Existing RaceBook/Pro entitlements are upgraded to Complete/Signature. Admin grants remain authoritative.

## Gotchas

- Code-splitting optional Organizer editors is only a bundle optimization. A dynamically loaded editor never grants public visibility or a paid operation.

- Never delete module content on disable or downgrade.
- Never expose `organizer_racebook_module_settings` directly to clients; mobile receives only an effective boolean map.
- Missing module configuration during rolling deployment uses the historical mobile behavior.
- Automatic Tax still requires the production Stripe account to have the appropriate tax registrations.
- Old clients saving a full `organizer_details` object must not erase protected subtrees.
- The dashboard keeps publication primary, groups rare actions in one menu, and starts detailed visibility collapsed. Expanding it is presentation-only; choosing a format state is a deliberate persisted action and must never grant an entitlement client-side.
- Offer and visibility consequences use contextual hover/focus help beside short controls. Hiding that explanatory copy visually does not weaken server-side readiness or entitlement checks, and errors remain visible inline.

## Related Docs

- [Organizer Race Management](organizer-race-management.md)
- [Stripe](../05-integrations/stripe.md)
- [organizer_racebook_module_settings](../02-database/tables/organizer-racebook-module-settings.md)
- [organizer_edition_entitlements](../02-database/tables/organizer-edition-entitlements.md)
- [organizer_edition_payments](../02-database/tables/organizer-edition-payments.md)
