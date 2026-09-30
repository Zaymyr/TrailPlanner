---
title: Affiliate Partner Links
scope: integration
last_verified: 2026-09-30
ai_priority: medium
related_files:
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

> Terminologie : les textes français destinés aux utilisateurs emploient **Livret coureur** et les textes anglais **Race Book**. Les identifiants techniques stables — routes, événements analytics, objets de base de données et valeurs historiques — conservent `racebook`.

## Purpose

Centralize Booking and Decathlon outbound destinations, switch each partner from its normal URL to its affiliate URL without changing mobile code, and expose them in the relevant RaceBook preparation surfaces.

## Key Concepts

- The Admin `Liens partenaires` tab is the only current partner-link management surface; the separate `Preuves sociales` tab has no access to these destinations or flags.
- Each partner has a standard URL, optional affiliate URL, affiliate-mode flag, and global enabled flag.
- `resolvePartnerLinkUrl` defines the shared selection rule: disabled means no URL; otherwise use the affiliate URL only when explicitly enabled, falling back to the standard URL.
- `GET /api/partner-links` is the public, read-only consumer contract. It returns only enabled resolved destinations plus the affiliation flag; raw configuration and disabled rows stay private.
- Mobile loads this additive contract with the RaceBook. Booking appears in the permanent Services tab; Decathlon appears in Matériel immediately above the required-equipment group.

## Admin Flow

`GET /api/admin/partner-links` and `PUT /api/admin/partner-links` require a bearer session whose trusted Auth `app_metadata` grants admin access. The route uses the service credential only after that check. The update validates both partner configurations and performs one PostgREST upsert, recording the admin user id and a shared timestamp.

The UI disables affiliate mode until an affiliate URL exists and previews the URL that would currently resolve. Both partners are seeded disabled, so deployment alone cannot publish outbound links.

## Mobile Consumer Contract

Mobile calls the narrow server endpoint instead of reading `partner_link_settings`. The response is CDN-cached for five minutes and degrades to an empty collection on request or validation failure so partner availability cannot make the RaceBook unavailable. The client accepts one HTTPS destination per known partner and renders the configured URL unchanged. Booking remains in Services with `action_context: services`; Decathlon uses the Matériel surface with `action_context: equipment` and a dynamic missing-required message. That count includes only active required equipment, so recommended items and weather-tagged items under an inactive weather plan are excluded. Analytics records only the bounded partner key/context, never the count or destination. Booking location/date parameters and Decathlon equipment-query parameters remain out of scope until their approved deep-link formats are known.

RaceBook gear-checklist analytics are independent from this contract: loading or toggling gear does not alter partner visibility, destinations, or outbound-link tracking.

## Disclosure

Standard links are not described as affiliate links. Each mobile surface discloses that Pace Yourself may receive a commission without additional cost to the runner only when its rendered destination is actually affiliate-backed.

## Validation

- Route tests cover loading, atomic upsert mapping, trusted actor audit, and rejection of affiliate mode without a URL.
- Public-route tests cover resolved standard/affiliate destinations, enabled-row filtering, cache headers, and upstream failure.
- Mobile normalization tests reject malformed, duplicated, unsupported, or non-HTTPS destinations.
- `supabase/tests/partner_link_settings_checks.sql` verifies RLS, privileges, seed rows, service updates, and database constraints.

## Gotchas

- Affiliate-network URLs may use a tracking-network host rather than the merchant host, so validation requires HTTPS but does not hard-code Booking or Decathlon hostnames.
- Do not display cached prices or stock from these configuration rows; they store destinations only.
- The older `affiliate_offers` table is scoped to product catalog offers and is not a replacement for these global partner destinations.
- Admin changes can take up to five minutes to leave the public CDN cache; pull-to-refresh then reloads the mobile partner contract.
- The Services tab remains visible even if the partner request temporarily fails. That failure shows its ordinary empty state and does not re-enable organizer-authored services whose module is inactive.
- Adding another Admin tab must not merge its persistence with the partner-link atomic upsert. Social proofs and partner destinations remain separate service-only contracts.

## Related Docs

- [`partner_link_settings`](../02-database/tables/partner-link-settings.md)
- [Web App Architecture](../01-architecture/web-app.md)
- [Analytics](analytics.md)
