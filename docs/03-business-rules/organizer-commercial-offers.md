---
title: Organizer Commercial Offers
scope: business-rule
last_verified: 2026-11-09
ai_priority: high
related_files:
  - apps/web/lib/organizer-entitlements.ts
  - apps/web/lib/organizer-modules.ts
  - apps/web/lib/organizer-module-settings.ts
  - apps/web/lib/organizer-publication-tier.ts
  - apps/web/lib/organizer-publication-tier.test.ts
  - apps/web/app/api/organizer/editions/[id]/module-settings/route.ts
  - apps/web/app/api/organizer/publication-checkout/route.ts
  - apps/web/app/api/stripe/webhook/route.ts
  - apps/web/app/api/admin/organizer-payments/route.ts
  - apps/web/app/api/admin/organizer-payments/preview/route.ts
  - apps/web/app/api/admin/organizer-payments/[paymentId]/invoice/route.ts
  - apps/web/app/api/admin/organizer-payments/[paymentId]/invoice/route.test.ts
  - apps/web/app/api/organizer/invoices/route.ts
  - apps/web/app/api/organizer/invoices/[paymentId]/download/route.ts
  - apps/web/lib/organizer-payments.ts
  - apps/web/lib/organizer-invoices.ts
  - apps/web/lib/organizer-invoices.test.ts
  - apps/web/lib/organizer-invoice-document.ts
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
  - supabase/migrations/20260911073318_add_organizer_manual_payments_and_invoices.sql
  - supabase/migrations/20260911091935_fix_bulk_organizer_racebook_publication.sql
  - supabase/migrations/20260911093649_add_organizer_publication_grant_origin.sql
  - supabase/migrations/20260911110037_fix_organizer_publication_and_manual_payment_consistency.sql
  - supabase/migrations/20260911114106_expose_private_formats_in_visible_catalog.sql
  - supabase/migrations/20260911120508_fix_single_format_publication_admin_check.sql
  - supabase/migrations/20260912172228_remove_trail_ton_chateau_vat.sql
  - supabase/migrations/20260915100443_add_generated_organizer_invoices.sql
  - supabase/tests/organizer_generated_invoice_checks.sql
  - supabase/tests/organizer_edition_entitlements_checks.sql
  - supabase/tests/organizer_racebook_module_settings_checks.sql
  - supabase/migrations/20260915104528_add_organizer_edition_capability_grants.sql
  - supabase/tests/organizer_edition_capability_grants_checks.sql
  - supabase/migrations/20261109190500_separate_organizer_invoices_and_feature_grants.sql
  - supabase/tests/organizer_manual_invoices_checks.sql
  - apps/web/lib/organizer-features.ts
  - apps/web/lib/organizer-features.test.ts
  - apps/web/lib/organizer-manual-invoices.ts
  - apps/web/app/api/admin/organizer-invoices/route.ts
  - apps/web/app/api/admin/organizer-invoices/preview/route.ts
  - apps/web/app/api/admin/organizer-feature-catalog/route.ts
related_tables:
  - organizer_edition_entitlements
  - organizer_edition_payments
  - organizer_racebook_module_settings
  - organizer_edition_capability_grants
  - organizer_invoices
  - organizer_feature_catalog
  - race_event_editions
---

# Organizer Commercial Offers

Course-point autosave now waits for the active format's ravito/supporter sidecars and preserves them across same-format refreshes. The guard prevents transient empty replacements and changes no module selection, effective capability, tier, or publication right.

The publication prerequisite is now name, date, effective location, and positive distance for at least one format; an official format website is optional. Autosave completes before offer/publication navigation through the existing foreground flush.

The organizer header shows the count of public formats. When all formats in the selected edition are public, the primary action becomes a runner preview instead of repeating publication; entitlements and server-side publication checks remain authoritative.

The `supporter_points` module remains an independent Essentiel module. Selecting an existing ravito or deriving access from the course GPX is editor convenience only and does not couple its entitlement to `aid_stations`.

> Terminologie : les textes français destinés aux utilisateurs emploient **Livret coureur** et les textes anglais **Race Book**. Les identifiants techniques stables — routes, événements analytics, objets de base de données et valeurs historiques — conservent `racebook`.

## Purpose

One offer is purchased per event edition, independently of participant and format counts. Event membership authorizes every draft editor; the offer authorizes public output and costly operations. Disabling or losing publication access masks content without deleting it.

The public `/organisateurs` page presents these edition offers after an acquisition hero whose secondary action scrolls to the Trail TST demonstration. Google Play remains available from that detailed demo and the final CTA surface. Neither demonstration path creates an organizer entitlement or starts a checkout.

Published organizer proof cards on the same page are independent editorial records. Their highlighted acquisition surface, prominent usage metrics, and visually separated testimonial are presentation only. Simplifying the adjacent hero phone by removing its floating explanatory badges, constraining it to the viewport height, or compacting the mobile information grid likewise changes no offer or entitlement. Featuring or depublishing an edition neither grants nor revokes its commercial tier, and the aggregate usage snapshot is not a billable participant count.

## Offers

| Offer | HT per edition | Main rights |
| --- | ---: | --- |
| Visibilité | Free | Public catalog only. |
| Essentiel | 99 € | RaceBook publication, basic equipment/bib/access, simple aid stations and supporter points. |
| Complet | 199 € | Essential plus advanced fields and per-format overrides, SAS, detailed aid stations, services, awards, notifications and duplication. |
| Signature | 349 € | Complete plus relay, official products, sponsors/clicks, branding, assisted import and RaceBook analytics. |

Direct purchases are 99/199/349 €. Valid upgrades are Essential→Complete 100 €, Essential→Signature 250 € and Complete→Signature 150 €.

## Module Contract

Uploading, replacing, choosing the RaceBook visibility of, or deleting a format GPX remains part of the permanent Course/GPX editor and does not require an offer upgrade. Deletion preserves stored course metrics and aid stations.



`event` and Course/GPX are permanent. Edition modules are `equipment`, `bib_pickup`, `access`, `services`, `branding`, `sponsors`. Format modules are `aid_stations`, `supporter_points`, `start_waves`, `awards`, `relay`, `official_products`. `supporter_points`, presented as **Suivi coureur**, belongs to Essentiel, defaults to enabled, participates in the Essentiel publication scope, and remains independent from `aid_stations`. Equipment, bib and access format overrides are centralized advanced groups requiring Complet; the editor marks them once with `Options avancées · Complet` instead of adding field badges.

The states are:

- `active`: enabled by the organizer and allowed by the offer; editable and publishable;
- `inactive`: disabled by the organizer; data retained and excluded from mobile/completion;
- `draftOnly`: enabled and editable, but above the current offer; data retained and excluded from every runner-facing response.

`apps/web/lib/organizer-entitlements.ts` is the publication/operation capability authority and `apps/web/lib/organizer-modules.ts` is the shared minimum-tier catalog. Organizer content routes use membership plus the selected module for authoring. Public reads and costly actions continue to require their effective capability. Draft access never creates an entitlement.

Every higher-tier feature may be offered independently for one edition. The catalog contains eight Complet features at 12.50 € each and six Signature features at 25 € each; these seeded totals match the current plan upgrade deltas. An active `organizer_edition_capability_grants` row supplements the current pack with only its exact module, advanced group or operation. Revocation keeps its audit row, and later pack changes preserve redundant gifts until explicit revocation. Essentiel exposes every Complet and Signature feature, Complet exposes Signature features, and Signature has no higher-tier gift selector.

The admin UI deliberately separates **Droits** from **Facturation**. Issuing, correcting or settling a manual invoice never grants a pack or feature, while an administrator may open rights with no invoice. Stripe remains the exception: its verified paid webhook continues to recalculate the purchased entitlement.

The web section chooser separates edition-common modules from per-format modules before batching local switch drafts into one typed module-settings PATCH. On the event tab, format-scoped changes target all existing formats and mixed values are labelled; on a format tab they target only the active format. Until the PATCH succeeds, the active dashboard navigation and completion use the last persisted configuration; failures keep the draft available for retry, and closing a modified regular chooser requires explicit discard confirmation.

Completion percentages count required modules only. Recommended and optional tiles keep their own empty/incomplete/complete status without lowering the bars. Event equipment is optional; inherited format equipment is optional too. Checking a format-specific equipment override makes that format tile required until its list contains at least one item, while free-text notes never satisfy that conditional requirement.

## Stripe and Rights Lifecycle

The server chooses one of six explicit one-time EUR Price IDs and validates active status, exact amount, non-recurring mode and exclusive tax behavior. Checkout enables automatic tax, billing address, tax-ID collection and invoice creation. A success redirect is not authorization; the webhook settles the payment, retains the Stripe Invoice id, and recalculates rights.

A trusted admin can choose the effective publication origin shown for an edition: operational `admin`, `complimentary` (Offert), ledger-backed `stripe`, or a pre-existing ledger-backed `manual_payment`. Admin and Offert grants may be created or changed directly. Stripe and legacy manual-payment origins require a matching valid payment path. New manual billing no longer creates an entitlement or an `organizer_edition_payments` row: it creates an independent `organizer_invoices` document with an editable pre-issuance preview, service date, J+30 default due date and server-owned catalog prices.

The admin can preview the exact server-rendered PDF without allocating a number. Issuance allocates the shared chronological number, snapshots the pack, customer, configurable option prices, one line per 100%-discounted gift, original subtotal, total discount and net due, then stores the PDF privately. An active unpaid invoice is changed only through a new numbered corrective invoice that explicitly replaces the original. A positive-net invoice may be marked paid once; a zero-net invoice displays `Aucun montant à régler`. Both transitions leave rights unchanged. Active event members can list unpaid, overdue, paid, zero-net and replaced documents and request a short private signed URL. Historical payment-backed and Stripe invoices remain available through the same normalized DTO.

The free Visibility tier may expose an event and its preview-selected private course formats in the runner catalog for plan creation; it does not expose their RaceBooks. The dashboard recommends the highest tier used by selected, populated sections. Its publication dialog states which content will publish and which will remain private for a lower choice. Checkout and RaceBook publication independently recompute the persisted requirement; choosing a lower valid paid offer never deletes excluded drafts. Each format now has one three-state selector backed by the existing booleans: `Masqué` clears preview and live, `Privé` enables preview and clears live, and `Public` enables both only after the server verifies readiness and the edition entitlement. Selecting `Public` while the edition still has the free Visibility tier opens the publication-offer dialog immediately instead of attempting a known-to-fail write; a server `403` opens that dialog only while the displayed tier is also Visibility. With Essential, Complete, or Signature already active, single-format and bulk publication share the same membership/admin, readiness, visible-edition, and active-entitlement contract; the unitary RPC isolates its trusted Auth admin lookup in a private service-only helper because `service_role` cannot read `auth.users` directly. Neither path opens an upsell for an already active paid tier, and operational failures stay visible as errors. Selected content above the active tier remains private through the effective-module filter. A publication checkout carries the initial publication intent through the webhook-confirmed return. The opt-in Playwright payment journey uses Stripe test mode only, waits for webhook-confirmed Essential access, and deletes its uniquely named `TEST` event in a `finally` cleanup.

Recalculation requires a valid paid path and assigns `stripe` or `manual_payment` from the transaction that supplies the effective tier. Refunding/disputing a base purchase invalidates dependent upgrades; invalidating only an upgrade returns to the valid lower tier. Legacy `racebook` payments map to Complete and legacy `pro_direct` or `racebook + pro_upgrade` paths map to Signature. Existing RaceBook/Pro entitlements are upgraded to Complete/Signature. Operational `admin`, explicit `complimentary`, and legacy admin grants remain authoritative until explicitly changed or converted.

## Gotchas

Publication is a versioned snapshot operation per format. Tier checks are repeated before snapshot construction; bulk edition publication is all-or-none, a downgrade masks unavailable published modules immediately, and an upgrade requires explicit republication.

- Runner annual and course offers are a distinct consumer billing model. Do not create `organizer_edition_payments` or organizer edition entitlements from their webhook events.

- The persisted-content scan runs before Stripe session creation. Every Supabase presence probe must select a real column; `race_event_edition_branding` is keyed by `edition_id`, so a generic `select=id` blocks checkout with a Data API 400.
- Code-splitting optional Organizer editors is only a bundle optimization. A dynamically loaded editor never grants public visibility or a paid operation.

- Never delete module content on disable or downgrade.
- Never infer complimentary analytics access from the pack source. Resolve the Signature tier and the active edition capability grant independently.
- Never expose `organizer_racebook_module_settings` directly to clients; mobile receives only an effective boolean map.
- Missing module configuration during rolling deployment uses the historical mobile behavior.
- Automatic Tax still requires the production Stripe account to have the appropriate tax registrations.
- Old clients saving a full `organizer_details` object must not erase protected subtrees.
- The dashboard keeps publication primary, groups rare actions in one menu, and starts detailed visibility collapsed. The guide may expand it temporarily to expose the real controls, then restores the collapsed state. Expansion is presentation-only; choosing a format state is a deliberate persisted action and must never grant an entitlement client-side.
- The admin publication dialog identifies the active pack and origin, exposes Visibilité as an explicit downgrade, and uses full-row radio targets for pack selection. It lets a trusted admin switch paid packs between Admin, Paiement Stripe, Paiement par virement, and Offert. For a new virement, HT remains the canonical selected-pack price and TVA is fixed to zero under article 293 B CGI; client identity is mandatory, and preview uses the same PDF renderer as issuance. Stripe remains ledger-backed; a new bank transfer creates its own ledger row, immutable invoice record, and right in one action. Bank-transfer failures remain visible inside the dialog, while an already paid same-tier purchase remains a duplicate.
- Client identity means legal name and billing address. SIREN is optional; if supplied it must contain nine digits, and when absent the shared preview/final renderer omits the SIREN line instead of printing an empty value.
- The generated PDF contains the required billing data, but a downloadable PDF is not itself transmission through a French approved e-invoicing platform. Do not describe this Storage flow as satisfying that separate delivery obligation.
- A numbered invoice blocks payment-row deletion, including an edition cascade. Keep the edition as financial history instead of bypassing the protection trigger.
- Historical invoice issuance is available only for a paid EUR bank transfer with no existing invoice, zero stored tax, and `amount_total = amount_subtotal`. Do not silently substitute today's catalog price or mutate the old payment to make it eligible.
- Preserve Supabase's Storage API base when turning `/object/sign/...` into an absolute invoice URL; resolving it against the bare project origin creates an invalid download despite successful membership authorization.
- Searching or paginating the admin publication-rights list is presentation-only. Search and offer filters are applied before ten-event pagination and never alter an edition entitlement, payment, or pending publication request.
- Raising the complete access-tab assignment card above the following blurred card keeps its autocomplete listboxes visible across sibling stacking contexts; it is presentation-only and has no effect on pack selection, entitlements, payments, or invoices.
- The searchable e-mail/event fields in the separate `Accès organisateurs` tab grant membership only; their bounded Auth suggestions and local event filtering never create or change an offer, payment, invoice, or edition entitlement.
- The workspace status labels are presentation-only: masked formats stay explicitly hidden from the mobile app, private formats remain runner-visible for plan creation but show `RaceBook privé`, and public formats show their public state. Keeping a masked format editable for authorized organizers/admins does not grant an offer or expose it to runners.
- Offer and visibility consequences use contextual hover/focus help beside short controls. Hiding that explanatory copy visually does not weaken server-side readiness or entitlement checks, and errors remain visible inline.
- Completing, skipping, or replaying the dashboard guide never creates or upgrades an organizer entitlement. `Terminer` closes it; its visually secondary configuration action only opens the existing section chooser.
- The new-edition dialog's spinner, busy announcement, and disabled controls are request feedback only. They neither grant the Complet duplication capability nor weaken the server-side capability check, and empty-edition creation remains available without that capability.
- Never infer a commercial entitlement from presence in the organizer proof section. Proof publication is trusted-admin editorial state backed by historical usage, not an offer source or payment path.
- Showing `Informations à jour`, the changed-field confirmation, or the version-history menu grants no commercial right. The final publish/restore request still enforces the active edition entitlement on the server.

## Related Docs

- [Organizer Race Management](organizer-race-management.md)
- [Stripe](../05-integrations/stripe.md)
- [organizer_racebook_module_settings](../02-database/tables/organizer-racebook-module-settings.md)
- [organizer_edition_entitlements](../02-database/tables/organizer-edition-entitlements.md)
- [organizer_edition_capability_grants](../02-database/tables/organizer-edition-capability-grants.md)
- [organizer_edition_payments](../02-database/tables/organizer-edition-payments.md)

## Partner slots option (2026-11-09)

The base RaceBook (every paid tier) shows Pace Yourself affiliate cards in the Matériel (Decathlon) and Services hébergement (Booking.com) slots. Replacing them with the organizer's own partners, or hiding them, is part of the Signature `sponsors.manage` capability (same gate as sponsors); no new module key, price or capability was added. <!-- TODO: verify with maintainer: dedicated pricing for a standalone "Partenaires" option is a business decision. -->
