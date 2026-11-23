---
title: Organizer Commercial Offers
scope: business-rule
last_verified: 2026-11-23
# Assisted legacy conversion (2026-11-15): conversion requires the effective assisted_import.request capability (Signature or its complimentary grant).
# Structured access phase (2026-11-15): optional parking and shuttle collections use geocoded locations, bounded notes and edition-day schedules; event inheritance and historical text fallbacks remain intact, while public pages expose summaries only.
# Structured cutoff phase (2026-11-15): optional day offsets make overnight and multi-day aid-station/final cutoffs deterministic; missing offsets preserve the historical clock heuristic, and relay clock columns remain text normalized client-side.
ai_priority: high
# Organizer UI note (2026-11-13): completion yields the contextual rail to media-heavy editors; offer and completion rules are unchanged.
# Organizer nav fixes (2026-11-17): Statistiques (with its Signature upsell) and Gérer les sections are reachable from the header Actions menu; offer rules are unchanged.
# Form note (2026-11-13): required badges are presentation of existing completion prerequisites and do not add offer gates.
# Navigation note (2026-11-13): the single active subsection state does not alter offer availability.
# Dense module note (2026-11-13): sponsor and course presentation changes do not alter offers.
# Mobile gutter note (2026-11-13): compact editor padding does not alter offers.
# Layout polish note (2026-11-13): organizer presentation changes (aid-station detail, format metrics row, media rail visibility, equipment status action) do not alter stored data or contracts.
# Fill-flow pass (2026-11-13): Sponsors/partner-slot ordering and the Services status label changed in the UI only; offer gating unchanged.
# Organizer UX pass (2026-11-14): format sections nest under the selected format in the left nav, ravito type is Ravito / Base de vie, and equipment uses a top quick-add with per-row Obligatoire switch; no stored data or contract changes.
# Course timeline note (2026-11-14): timeline filters, point markers and cutoff chips in the aid-station editor are presentation-only; stored data and contracts are unchanged.
related_files:
  - apps/web/app/admin/_components/organizers/organizer-admin-model.ts
  - apps/web/app/admin/_components/organizers/useOrganizerAdminData.ts
  - apps/web/app/admin/_components/organizers/EditionDrawer.tsx
  - apps/web/app/admin/_components/organizers/EditionPackForm.tsx
  - apps/web/app/admin/_components/organizers/OrganizerRequestItems.tsx
  - apps/web/app/admin/_components/billing/OrganizerInvoiceDialog.tsx
  - apps/web/app/admin/_components/billing/BankTransferDialog.tsx
  - apps/web/app/admin/_components/billing/HistoricalInvoiceDialog.tsx
  - apps/web/lib/admin-billing.ts
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
  - apps/web/lib/organizer-sponsor-report.ts
  - apps/web/lib/organizer-sponsor-report.test.ts
  - apps/web/lib/organizer-sponsor-report-document.ts
  - apps/web/app/api/organizer/editions/[id]/sponsor-report/route.ts
  - apps/web/app/api/organizer/editions/[id]/sponsor-report/route.test.ts
  - apps/web/app/organizer/_components/dashboard/sponsor-report-card.tsx
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
  - supabase/migrations/20261109192905_remove_organizer_gift_feature_prices.sql
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

The edition-level **Livret supporter** (`supporter_guide`, English: **Supporter Guide**) is included from Essential through Signature and defaults to enabled. It aggregates immutable format publications without widening source rights: services, waves, awards, sponsors and every other section remain masked unless their own module is effective. The organizer header exposes its published preview and a downloadable QR link.

Course-point autosave now waits for the active format's ravito/supporter sidecars and preserves them across same-format refreshes. The guard prevents transient empty replacements and changes no module selection, effective capability, tier, or publication right.

The publication prerequisite is now name, date, effective location, and positive distance for at least one format; an official format website is optional. Autosave completes before offer/publication navigation through the existing foreground flush.

The organizer header shows the count of public formats. When all formats in the selected edition are public, the primary action becomes a runner preview instead of repeating publication; entitlements and server-side publication checks remain authoritative.

The `supporter_points` module remains an independent Essentiel module. Selecting an existing ravito or deriving access from the course GPX is editor convenience only and does not couple its entitlement to `aid_stations`.

> Terminologie : les textes français destinés aux utilisateurs emploient **Livret coureur** et les textes anglais **Race Book**. Les identifiants techniques stables — routes, événements analytics, objets de base de données et valeurs historiques — conservent `racebook`.

Organizer form, completion, and navigation refinements are presentation-only: they do not grant a tier, modify effective modules, or bypass server-side publication readiness and entitlement checks.

## Purpose

One offer is purchased per event edition, independently of participant and format counts. Event membership authorizes every draft editor; the offer authorizes public output and costly operations. Disabling or losing publication access masks content without deleting it.

The public `/organisateurs` page presents these edition offers after an acquisition hero whose secondary action scrolls to the Trail TST demonstration. The hero presents both edition surfaces side by side, the Livret coureur (in the app) and the Livret supporter (public web link and QR code, no account), and the Essentiel offer lists both; the small supporter preview is an illustration, not published data, and the copy adds no offer gate. The App Store and Google Play listings are available from that detailed demo and the final CTA surface. Each pricing card has one CTA (Essentiel and Complet reuse the event-creation entry, Signature scrolls to the demo request form) and Complet is flagged « Recommandé », an editorial marker with no usage claim; the cards read their prices from `ORGANIZER_TIER_PRICE_EUR` and state « Prix HT par édition, sans abonnement ». The Signature card lists « Rapport partenaires » among its features. These CTAs start no checkout and create no entitlement. Neither demonstration path creates an organizer entitlement or starts a checkout. The social-proof block above the offers (race logo, testimonial, compact metrics) is presentation only and changes no offer.

Published organizer proof cards on the same page are independent editorial records. Their highlighted acquisition surface, prominent usage metrics, and visually separated testimonial are presentation only. Simplifying the adjacent hero phone by removing its floating explanatory badges, constraining it to the viewport height, or compacting the mobile information grid likewise changes no offer or entitlement. Featuring or depublishing an edition neither grants nor revokes its commercial tier, and the aggregate usage snapshot is not a billable participant count.

## Offers

| Offer | HT per edition | Main rights |
| --- | ---: | --- |
| Visibilité | Free | Public catalog only. |
| Essentiel | 199 € | RaceBook publication, basic equipment/bib/access, simple aid stations and supporter points. |
| Complet | 349 € | Essential plus advanced fields and per-format overrides, SAS, detailed aid stations, services, awards, notifications and duplication. |
| Signature | 499 € | Complete plus relay, official products, sponsors/clicks, the post-race partner report (Rapport partenaires), branding, assisted import and RaceBook analytics. |

Direct purchases are 199/349/499 €. Valid upgrades charge the price difference: Essential→Complete 150 €, Essential→Signature 300 € and Complete→Signature 150 €. The single source of truth is `ORGANIZER_TIER_PRICE_EUR` in `apps/web/lib/organizer-modules.ts`; checkout, admin bank-transfer invoices and dashboard copy derive from it. Payments and invoices recorded before the 2026-11-22 price change keep their stored amounts.

## Module Contract

Uploading, replacing, choosing the RaceBook visibility of, or deleting a format GPX remains part of the permanent Course/GPX editor and does not require an offer upgrade. Deletion preserves stored course metrics and aid stations.



`event` and Course/GPX are permanent. Edition modules are `equipment`, `bib_pickup`, `access`, `services`, `branding`, `sponsors`. Format modules are `aid_stations`, `supporter_points`, `start_waves`, `awards`, `relay`, `official_products`. `supporter_points`, presented as **Suivi coureur**, belongs to Essentiel, defaults to enabled, participates in the Essentiel publication scope, and remains independent from `aid_stations`. Equipment, bib and access format overrides are centralized advanced groups requiring Complet; the editor marks them once with `Options avancées · Complet` instead of adding field badges.

The states are:

- `active`: enabled by the organizer and allowed by the offer; editable and publishable;
- `inactive`: disabled by the organizer; data retained and excluded from mobile/completion;
- `draftOnly`: enabled and editable, but above the current offer; data retained and excluded from every runner-facing response.

`apps/web/lib/organizer-entitlements.ts` is the publication/operation capability authority and `apps/web/lib/organizer-modules.ts` is the shared minimum-tier catalog. Organizer content routes use membership plus the selected module for authoring. Public reads and costly actions continue to require their effective capability. Draft access never creates an entitlement.

Every higher-tier feature may be offered independently for one edition. The availability catalog contains eight Complet features and six Signature features, without standalone prices because these capabilities are not sold a la carte. An active `organizer_edition_capability_grants` row supplements the current pack with only its exact module, advanced group or operation. Revocation keeps its audit row, and later pack changes preserve redundant gifts until explicit revocation. Essentiel exposes every Complet and Signature feature, Complet exposes Signature features, and Signature has no higher-tier gift selector.

The admin UI deliberately separates **Droits** (Organisateurs › fiche de l’édition › « Pack & modules », formerly the « Gérer le pack et les accès » dialog) from **Facturation** (« Ventes & facturation », `/admin/billing`, since 2026-11-23). Issuing, correcting or settling a manual invoice never grants a pack or feature, while an administrator may open rights with no invoice. Stripe remains the exception: its verified paid webhook continues to recalculate the purchased entitlement.

The web section chooser separates edition-common modules from per-format modules before batching local switch drafts into one typed module-settings PATCH. On the event tab, format-scoped changes target all existing formats and mixed values are labelled; on a format tab they target only the active format. Until the PATCH succeeds, the active dashboard navigation and completion use the last persisted configuration; failures keep the draft available for retry, and closing a modified regular chooser requires explicit discard confirmation.

Completion percentages count required modules only. Recommended and optional tiles keep their own empty/incomplete/complete status without lowering the bars. Event equipment is optional; inherited format equipment is optional too. Checking a format-specific equipment override makes that format tile required until its list contains at least one item, while free-text notes never satisfy that conditional requirement.

## Stripe and Rights Lifecycle

The server chooses one of six explicit one-time EUR Price IDs and validates active status, exact amount, non-recurring mode and exclusive tax behavior. Checkout enables automatic tax, billing address, tax-ID collection and invoice creation. A success redirect is not authorization; the webhook settles the payment, retains the Stripe Invoice id, and recalculates rights.

A trusted admin can choose the effective publication origin shown for an edition: operational `admin`, `complimentary` (Offert), ledger-backed `stripe`, or a pre-existing ledger-backed `manual_payment`. Admin and Offert grants may be created or changed directly. Stripe and legacy manual-payment origins require a matching valid payment path. New manual billing no longer creates an entitlement or an `organizer_edition_payments` row: it creates an independent `organizer_invoices` document with an editable pre-issuance preview, service date and J+30 default due date.

The admin can preview the exact server-rendered PDF without allocating a number. Issuance allocates the shared chronological number, snapshots the pack and customer, writes one non-monetary `OFFERT` line per gift, and computes original subtotal, discount and net due from the pack only. An active unpaid invoice is changed only through a new numbered corrective invoice that explicitly replaces the original. A positive-net invoice may be marked paid once; a zero-net invoice displays `Aucun montant à régler`. Both transitions leave rights unchanged. Active event members can list unpaid, overdue, paid, zero-net and replaced documents and request a short private signed URL; a missing PDF is rendered and stored lazily after authorization. Historical payment-backed and Stripe invoices remain available through the same normalized DTO.

The free Visibility tier may expose an event and its preview-selected private course formats in the runner catalog for plan creation; it does not expose their RaceBooks. The dashboard recommends the highest tier used by selected, populated sections. Its publication dialog states which content will publish and which will remain private for a lower choice. Checkout and RaceBook publication independently recompute the persisted requirement; choosing a lower valid paid offer never deletes excluded drafts. Each format now has one three-state selector backed by the existing booleans: `Masqué` clears preview and live, `Privé` enables preview and clears live, and `Public` enables both only after the server verifies readiness and the edition entitlement. Selecting `Public` while the edition still has the free Visibility tier opens the publication-offer dialog immediately instead of attempting a known-to-fail write; a server `403` opens that dialog only while the displayed tier is also Visibility. With Essential, Complete, or Signature already active, single-format and bulk publication share the same membership/admin, readiness, visible-edition, and active-entitlement contract; the unitary RPC isolates its trusted Auth admin lookup in a private service-only helper because `service_role` cannot read `auth.users` directly. Neither path opens an upsell for an already active paid tier, and operational failures stay visible as errors. Selected content above the active tier remains private through the effective-module filter. A publication checkout carries the initial publication intent through the webhook-confirmed return. The opt-in Playwright payment journey uses Stripe test mode only, waits for webhook-confirmed Essential access, and deletes its uniquely named `TEST` event in a `finally` cleanup.

Recalculation requires a valid paid path and assigns `stripe` or `manual_payment` from the transaction that supplies the effective tier. Refunding/disputing a base purchase invalidates dependent upgrades; invalidating only an upgrade returns to the valid lower tier. Legacy `racebook` payments map to Complete and legacy `pro_direct` or `racebook + pro_upgrade` paths map to Signature. Existing RaceBook/Pro entitlements are upgraded to Complete/Signature. Operational `admin`, explicit `complimentary`, and legacy admin grants remain authoritative until explicitly changed or converted.

## Gotchas

- The "Vidéo de survol" (29.99 EUR collab, 59.99 EUR MP4) sold on `/survol` is an independent product outside the offer catalog and the module contract: it grants no entitlement, writes no `organizer_edition_payments` row, and the Stripe webhook routes its `flyover_video` checkouts to their own table before the organizer branch (organizer behavior unchanged). Its orders are managed in Admin › Publications › Survols, not in the organizer payments admin. See [Organizer Flyover Video Orders](flyover-video-orders.md).
- Compact Organizer header and section navigation changes do not alter offer tiers, checkout eligibility, or publication CTA authorization.

Publication is a versioned snapshot operation per format. Tier checks are repeated before snapshot construction; bulk edition publication is all-or-none, a downgrade masks unavailable published modules immediately, and an upgrade requires explicit republication.

- Runner annual and course offers are a distinct consumer billing model. Do not create `organizer_edition_payments` or organizer edition entitlements from their webhook events.

- The persisted-content scan runs before Stripe session creation. Every Supabase presence probe must select a real column; `race_event_edition_branding` is keyed by `edition_id`, so a generic `select=id` blocks checkout with a Data API 400.
- Code-splitting optional Organizer editors is only a bundle optimization. A dynamically loaded editor never grants public visibility or a paid operation.

- Never delete module content on disable or downgrade.
- Never infer complimentary analytics access from the pack source. Resolve the Signature tier and the active edition capability grant independently.
- Never assign or display a standalone monetary value for an offered feature. Only the pack has a catalog price and invoice discount.
- Never expose `organizer_racebook_module_settings` directly to clients; mobile receives only an effective boolean map.
- Missing module configuration during rolling deployment uses the historical mobile behavior.
- Automatic Tax still requires the production Stripe account to have the appropriate tax registrations.
- Old clients saving a full `organizer_details` object must not erase protected subtrees.
- The dashboard keeps publication primary, groups rare actions in one menu, and starts detailed visibility collapsed. The guide may expand it temporarily to expose the real controls, then restores the collapsed state. Expansion is presentation-only; choosing a format state is a deliberate persisted action and must never grant an entitlement client-side.
- The admin publication dialog identifies the active pack and origin, exposes Visibilité as an explicit downgrade, and uses full-row radio targets for pack selection. It lets a trusted admin switch paid packs between Admin, Paiement Stripe, Paiement par virement, and Offert; it bills nothing. A new virement is recorded from « Ventes & facturation › Enregistrer un virement » (`BankTransferDialog`, 2026-11-23). For a new virement, HT remains the canonical selected-pack price and TVA is fixed to zero under article 293 B CGI; client identity is mandatory, and preview uses the same PDF renderer as issuance. Stripe remains ledger-backed; a new bank transfer creates its own ledger row, immutable invoice record, and right in one action. Bank-transfer failures remain visible inside the dialog, while an already paid same-tier purchase remains a duplicate.
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
- [Organizer Flyover Video Orders](flyover-video-orders.md)

## Partner slots option (2026-11-09)

The base RaceBook (every paid tier) shows Pace Yourself affiliate cards in the Matériel (Decathlon) and Services hébergement (Booking.com) slots. Replacing them with the organizer's own partners, or hiding them, is part of the Signature `sponsors.manage` capability (same gate as sponsors); no new module key, price or capability was added. <!-- TODO: verify with maintainer: dedicated pricing for a standalone "Partenaires" option is a business decision. -->

The compact organizer workspace and corrected completion indicator are presentation-only and do not change tiers, checkout gates or publication entitlements.

The Organizer three-column shell repositions offer-aware section states and publication actions without changing module availability, pricing, entitlements, or checkout gates.

Organizer section-header and module-card finishing does not change offer availability, sponsor access, pricing, or publication entitlements.

Organizer demo requests (2026-11-16): `/organisateurs` offers a « Demander une démo » form (e-mail and race link required, phone optional) stored in the service-only `organizer_demo_requests` table and listed in the admin inbox tab « Demandes de course »; it creates no account, membership, entitlement or payment. See [organizer_demo_requests](../02-database/tables/organizer-demo-requests.md).

Admin (2026-11-22): pending publication requests are counted in the Organisateurs badges of `/admin` (`GET /api/admin/inbox-counts`); no change to offers or pricing.

Admin console (2026-11-23, lot 4): billing left the Organisateurs tab for « Ventes & facturation » (`/admin/billing`), a read-only register of organizer packs (Stripe and bank transfers), manual invoices, flyover orders and runner purchases, with the existing invoice actions in a side panel. The manual invoice, historical virement invoice and new virement dialogs moved there unchanged (same routes, same server-side pricing, VAT and numbering rules); the new virement dialog is the first screen of `POST /api/admin/organizer-payments`. On `/organizer`, the admin-only « Offrir une offre partenaire » buttons (second pack-grant path, PATCH `setEditionTier`) were removed: admins follow « Gérer le pack dans l’admin » to `/admin/organizers?edition=<id>`, where « Gérer le pack et les accès » (origin Offert included) is the single pack-grant action. The `setEditionTier` API action is kept for compatibility. No offer, price, entitlement or invoice rule changes.

Admin console (2026-11-23, lot 5): Organisateurs is split into domain components (`app/admin/_components/organizers/`: giftable module catalog, pending requests, rights per edition, organizer assignment, active accesses; data and review actions in `useOrganizerAdminData`, same requests). An edition opens a side panel (`?edition=<id>&fiche=resume|pack|facturation|demandes|activite`; a `?edition=` link from Ventes & facturation or `/organizer` still narrows the list to that edition): Résumé (event, edition, member organizers, Racebook state per format, links to `/organizer?eventId=` and to `/courses/evenements/<slug>`), Pack & modules (the former « Gérer le pack et les accès » dialog, same fields and same PATCH `setEditionGrant` then `setEditionCapabilityGrant` calls), Facturation (summary, filtered register, invoice and bank-transfer dialogs), Demandes (this edition's publication requests, claims and new-edition requests with the same review actions) and Activité (the stored social-proof reader statistics). `GET /api/admin/event-publication-requests` also returns `editionSlug` per edition (read from `race_event_editions.slug`). No rule, state or attribution route changes.

## Admin audit journal (lot 7)

`app/api/admin/event-publication-requests/route.ts`, `app/api/admin/organizer-feature-catalog/route.ts`, `app/api/admin/organizer-invoices/route.ts`, `app/api/admin/organizer-payments/[paymentId]/invoice/route.ts`, `app/api/admin/organizer-payments/route.ts` now export their write handlers through `withAdminAudit` (`apps/web/lib/admin-audit-log.ts`): each successful or server-failed call writes one best-effort line (`edition.publication`, `edition.pack`, `edition.module-catalog`, `billing.invoice-create`, `billing.payment-invoice`, `billing.payment-create`) to the admin action journal ([`admin_audit_log`](../02-database/tables/admin-audit-log.md), shown in `/admin/system/audit`). The request and response contracts, the business rules and the schema described here are unchanged.
## Rapport partenaires (2026-11-22)
Signature includes a downloadable post-race **Rapport partenaires** for one edition (PDF and CSV, titled « Rapport partenaires — <événement> <édition> »). `GET /api/organizer/editions/:id/sponsor-report?format=json|csv|pdf` requires a valid session, active parent-event membership (a trusted admin bypasses membership only, as on the Statistics route) and the same effective gate as the sponsors module: an active Signature tier or the exact `module.sponsors` complimentary grant (`canEnableOrganizerModule(..., "sponsors", ...)`). It does not require the Sponsors section to be currently selected, because the counters of a finished campaign remain stored. Lower tiers receive `403`; the dashboard shows the card locked under the Sponsors editor and reuses the existing pricing dialog (`openPricingDialog("upgrade")`). No new tier, capability, feature key, price or migration is introduced.
The report aggregates only: per-sponsor cumulative `impression_count` / `click_count` and configured placements from `race_event_edition_sponsors`, per-slot counters of partner-mode `race_event_edition_partner_slots`, totals and click-through rate, the five best placements, and — only when `racebook_analytics.view` is also effective — the Statistics endpoint summary (estimated unique readers, opens, active duration, engagement) over the campaign window. The window runs from the first `racebook_publications.published_at` of the edition (else the first sponsor creation, else the edition start) to the edition end + 30 days, capped at today. A PostHog failure yields `readers.status = "unavailable"` and still ships the sponsor counters. No runner identity, network identifier, view id, logo or destination URL is included. CSV is semicolon-separated UTF-8 with BOM and CRLF, and neutralizes spreadsheet formulas; the PDF is rendered server-side with pdf-lib (Helvetica, Pace Yourself forest/sand/orange tokens) like organizer invoices, replacing characters Helvetica cannot encode.
- Gotcha: sponsor and slot counters have no time dimension; they are cumulative since each partner went live, while reader figures cover only the campaign window. The report states this in its methodology box. Per-placement impressions of a sponsor (loading vs hero vs contextual) are not stored separately, so a sponsor row lists its placements but one total.
