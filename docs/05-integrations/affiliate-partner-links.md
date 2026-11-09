---
title: Affiliate Partner Links
scope: integration

last_verified: 2026-11-09

ai_priority: medium
related_files:
  - apps/web/lib/racebook-partner-slots.ts
  - apps/web/lib/partner-links.ts
  - apps/web/lib/partner-links.test.ts
  - apps/web/app/api/admin/partner-links/route.ts
  - apps/web/app/api/admin/partner-links/route.test.ts
  - apps/web/app/api/partner-links/route.ts
  - apps/web/app/api/partner-links/route.test.ts
  - apps/web/app/admin/page.tsx
  - apps/web/app/admin/_components/AdminPartnerLinksTab.tsx
  - apps/mobile/lib/partnerLinks.ts
  - apps/mobile/lib/partnerLinks.test.ts
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/components/racebook/RacebookGearSection.tsx
  - apps/mobile/components/racebook/RacebookServicesSection.tsx
  - apps/web/locales/fr.ts
  - apps/web/locales/en.ts
  - apps/web/locales/types.ts
  - supabase/migrations/20260928123934_add_partner_link_settings.sql
  - supabase/tests/partner_link_settings_checks.sql
related_tables:
  - partner_link_settings
  - affiliate_offers
---

# Affiliate Partner Links

The shared mobile RaceBook screen now also renders additive third-party bib-pickup conditions. Booking/Decathlon destination resolution, affiliation disclosure, outbound analytics, and URL validation remain unchanged.

The admin page's messaging inbox (bugs, feedback, race requests) and user-message actions are separate operational surfaces. They do not share partner-link configuration, destinations, caches, or the atomic partner settings upsert.

The header-attached workspace switch, full-width profile chart and plan unlock badge do not change partner links or their tracking.

Chronological cutoff resolution, the Courses image placeholder and plan access gating do not change partner links or their tracking.

The race-workspace header toolbar/footer layout (lot 10) does not change partner-link resolution, placement, click tracking, or destinations.

The separate admin link to `/admin/video-generator` does not share partner-link configuration, persistence, destinations, or analytics.

Moving official timing into the shared RaceBook header and removing its duplicate Trace row does not change partner-link resolution, placement, click tracking, or destinations.

La carte Decathlon mobile apparaît après la checklist Matériel et utilise une formulation sans nombre : les données publiées ne permettent pas de distinguer fiablement tout ce qui s'achète. La destination, la mention d'affiliation et l'action analytics bornée restent inchangées. Booking reste dans Services.

RaceBook personal passage interpolation emits no partner click and does not alter affiliate attribution.

> Terminologie : les textes français destinés aux utilisateurs emploient **Livret coureur** et les textes anglais **Race Book**. Les identifiants techniques stables — routes, événements analytics, objets de base de données et valeurs historiques — conservent `racebook`.

## Purpose

RaceBook owner-only plan reflection is separate from affiliate presentation. It must not pass personal timing, products, equipment completion, or official-revision state to a partner link or its analytics.

Centralize Booking and Decathlon outbound destinations, switch each partner from its normal URL to its affiliate URL without changing mobile code, and expose them in the relevant RaceBook preparation surfaces.

## Key Concepts

- The Admin `Liens partenaires` tab is the only current partner-link management surface; the separate `Preuves sociales` tab has no access to these destinations or flags.
- Each partner has a standard URL, optional affiliate URL, affiliate-mode flag, and global enabled flag.
- `resolvePartnerLinkUrl` defines the shared selection rule: disabled means no URL; otherwise use the affiliate URL only when explicitly enabled, falling back to the standard URL.
- `GET /api/partner-links` is the public, read-only consumer contract. It returns only enabled resolved destinations plus the affiliation flag; raw configuration and disabled rows stay private.
- Mobile loads this additive contract with the RaceBook. Booking appears in the permanent Services tab; Decathlon appears after the Matériel checklist with non-numeric copy.

## Admin Flow

`GET /api/admin/partner-links` and `PUT /api/admin/partner-links` require a bearer session whose trusted Auth `app_metadata` grants admin access. The route uses the service credential only after that check. The update validates both partner configurations and performs one PostgREST upsert, recording the admin user id and a shared timestamp.

The UI disables affiliate mode until an affiliate URL exists and previews the URL that would currently resolve. Both partners are seeded disabled, so deployment alone cannot publish outbound links.

## Mobile Consumer Contract

Mobile calls the narrow server endpoint instead of reading `partner_link_settings`. The response is CDN-cached for five minutes and degrades to an empty collection on request or validation failure so partner availability cannot make the RaceBook unavailable. The client accepts one HTTPS destination per known partner and renders the configured URL unchanged. Booking remains in Services with `action_context: services`; Decathlon follows the Matériel checklist with `action_context: equipment` and generic copy because the destination contract cannot reliably distinguish purchasable unchecked items. Analytics records only the bounded partner key/context, never a checklist count or destination. Booking location/date parameters and Decathlon equipment-query parameters remain out of scope until their approved deep-link formats are known.

RaceBook gear-checklist analytics are independent from this contract: loading or toggling gear does not alter partner visibility, destinations, or outbound-link tracking.

## Disclosure

Standard links are not described as affiliate links. Each mobile surface discloses that Pace Yourself may receive a commission without additional cost to the runner only when its rendered destination is actually affiliate-backed.

## Validation

- Route tests cover loading, atomic upsert mapping, trusted actor audit, and rejection of affiliate mode without a URL.
- Public-route tests cover resolved standard/affiliate destinations, enabled-row filtering, cache headers, and upstream failure.
- Mobile normalization tests reject malformed, duplicated, unsupported, or non-HTTPS destinations.
- `supabase/tests/partner_link_settings_checks.sql` verifies RLS, privileges, seed rows, service updates, and database constraints.

## Gotchas

- Shared web locale types now also carry navigation and not-found accessibility copy. That extension is unrelated to partner-link resolution and must not change allowlisting, attribution, or outbound click behavior.

- Central plan paywall CTAs are not partner-link surfaces and must not resolve or track affiliate destinations.

- Catalog plan CTAs and the RaceBook/Mon plan workspace switch do not resolve, display, or track a partner link. Partner disclosure remains limited to the existing eligible mobile partner surfaces.

- The RaceBook plan CTA is independent from the partner-link contract. Opening or refining a runner plan never changes a Booking or Decathlon destination.
- Affiliate-network URLs may use a tracking-network host rather than the merchant host, so validation requires HTTPS but does not hard-code Booking or Decathlon hostnames.
- Do not display cached prices or stock from these configuration rows; they store destinations only.
- The older `affiliate_offers` table is scoped to product catalog offers and is not a replacement for these global partner destinations.
- Admin changes can take up to five minutes to leave the public CDN cache; pull-to-refresh then reloads the mobile partner contract.
- The Services tab remains visible even if the partner request temporarily fails. That failure shows its ordinary empty state and does not re-enable organizer-authored services whose module is inactive.
- Adding another Admin tab must not merge its persistence with the partner-link atomic upsert. Social proofs and partner destinations remain separate service-only contracts.
- The owner-only Livret/Mon plan switch can reuse a saved-plan editor warm state only for the exact plan id; personal duration, pace and departure appear in the Livret hero, while compact ravito passage/segment timing and its late warning remain local presentation. None of those values may become partner-link parameters, destinations, or analytics properties.

## Related Docs

Supporter `S’y rendre` and `Voir le plan` actions open organizer-authored access URLs directly. They are not affiliate destinations and must not pass through partner redirects or counters.

- [`partner_link_settings`](../02-database/tables/partner-link-settings.md)
- [Web App Architecture](../01-architecture/web-app.md)
- [Analytics](analytics.md)

The labeled RaceBook Maps action, shared distance formatting, and plan-switch visual standardization do not change affiliate destinations, redirect accounting, or partner parameters.

Booking and Decathlon remain outside the versioned RaceBook snapshot. Mobile loads their current server-resolved destinations in parallel with published RaceBook content; restoring a RaceBook version never restores or rewrites a partner destination.

Progressive plan disclosure (2026-11-09): the plan is optional in the RaceBook. Runners without an owned plan for the format see no `Livret officiel | Mon plan` switch, no `Temps prévu`/`Allure` hero metrics and an unattached hero; the only plan entry is the discreet `RacebookPlanInviteCard` at the end of the Course route/ravitos sub-tabs (hidden in guided RaceBook onboarding, for past races and when D+ is unknown). Once a plan exists, the switch (labelled `Mon plan`) and plan metrics appear and the plan keeps enriching the Livret. This is runner presentation only: it reads and writes no row of this domain.

RaceBook polish (2026-11-09): the runner hero keeps the format/event thumbnail but renders it blurred (`blurRadius` 8) under a 90% organizer-primary veil, so no artwork text is readable behind the identity, omits the default `Solo` participation label, appends a `J-N`/`Aujourd'hui` countdown to the date line (hidden after race day), and moves its expanded block up with the collapse so titles never overlap and metrics are never clipped. Runner wording was simplified (`Où encourager`, `Barrière horaire`, `Sac d'allègement`, `Nourriture`, `Relais {n}`, weather-alert and partial-route sentences). Access transport notes turn pasted URLs into labelled buttons (`Réserver ma navette` / `Ouvrir le lien`) and bib pickup addresses without an organizer maps link fall back to a Google Maps search (`lib/racebookTextLinks.ts`). Profile cumulative tiles show `—` until the runner touches the curve. This is runner presentation only: no row, contract or tracking of this domain changes.

## Organizer partner slots (2026-11-09)

The Decathlon (Matériel) and Booking (Services) cards are partner slots. The default remains the resolved affiliate link and its disclosure. When a published Signature RaceBook replaces a slot with an organizer partner, mobile renders the partner name, logo, headline and `Découvrir` action through the counted `/api/racebook-partner-slots/:slot/click` redirect, without the affiliate disclosure and without a `partner_*` RaceBook action; a hidden slot renders no card. The partner-links endpoint and affiliate destinations are unchanged.
