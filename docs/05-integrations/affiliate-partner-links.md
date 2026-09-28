---
title: Affiliate Partner Links
scope: integration
last_verified: 2026-09-28
ai_priority: medium
related_files:
  - apps/web/lib/partner-links.ts
  - apps/web/lib/partner-links.test.ts
  - apps/web/app/api/admin/partner-links/route.ts
  - apps/web/app/api/admin/partner-links/route.test.ts
  - apps/web/app/admin/page.tsx
  - apps/web/app/admin/_components/AdminPartnerLinksTab.tsx
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

## Purpose

Centralize Booking and Decathlon outbound destinations before their affiliate programmes are approved, then switch each partner from its normal URL to its affiliate URL without changing consuming screens.

## Key Concepts

- The Admin `Liens partenaires` tab is the only current management surface.
- Each partner has a standard URL, optional affiliate URL, affiliate-mode flag, and global enabled flag.
- `resolvePartnerLinkUrl` defines the shared selection rule: disabled means no URL; otherwise use the affiliate URL only when explicitly enabled, falling back to the standard URL.
- This first increment manages configuration only. It does not add Booking or Decathlon CTAs to the mobile RaceBook.

## Admin Flow

`GET /api/admin/partner-links` and `PUT /api/admin/partner-links` require a bearer session whose trusted Auth `app_metadata` grants admin access. The route uses the service credential only after that check. The update validates both partner configurations and performs one PostgREST upsert, recording the admin user id and a shared timestamp.

The UI disables affiliate mode until an affiliate URL exists and previews the URL that would currently resolve. Both partners are seeded disabled, so deployment alone cannot publish outbound links.

## Future Consumer Contract

Booking and Decathlon consumers should call a narrow server endpoint that returns only enabled, resolved destinations. Booking can later append allowlisted location/date parameters, while Decathlon can append an encoded missing-equipment query if the approved affiliate deep-link format permits it. Consumers must not reimplement the standard-versus-affiliate selection rule.

## Disclosure

Standard links must not be described as affiliate links. Once affiliate mode is active, the consuming surface must disclose that Pace Yourself may receive a commission without additional cost to the runner.

## Validation

- Route tests cover loading, atomic upsert mapping, trusted actor audit, and rejection of affiliate mode without a URL.
- `supabase/tests/partner_link_settings_checks.sql` verifies RLS, privileges, seed rows, service updates, and database constraints.

## Gotchas

- Affiliate-network URLs may use a tracking-network host rather than the merchant host, so validation requires HTTPS but does not hard-code Booking or Decathlon hostnames.
- Do not display cached prices or stock from these configuration rows; they store destinations only.
- The older `affiliate_offers` table is scoped to product catalog offers and is not a replacement for these global partner destinations.

## Related Docs

- [`partner_link_settings`](../02-database/tables/partner-link-settings.md)
- [Web App Architecture](../01-architecture/web-app.md)
- [Analytics](analytics.md)
