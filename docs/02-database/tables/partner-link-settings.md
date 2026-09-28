---
title: partner_link_settings
scope: database
last_verified: 2026-09-28
ai_priority: medium
related_files:
  - supabase/migrations/20260928123934_add_partner_link_settings.sql
  - supabase/tests/partner_link_settings_checks.sql
  - apps/web/lib/partner-links.ts
  - apps/web/lib/partner-links.test.ts
  - apps/web/app/api/admin/partner-links/route.ts
  - apps/web/app/api/admin/partner-links/route.test.ts
  - apps/web/app/api/partner-links/route.ts
  - apps/web/app/api/partner-links/route.test.ts
  - apps/web/app/admin/_components/AdminPartnerLinksTab.tsx
  - apps/mobile/lib/partnerLinks.ts
  - apps/mobile/lib/partnerLinks.test.ts
related_tables:
  - partner_link_settings
---

# `partner_link_settings`

## Purpose

Stores the global outbound destinations for Booking and Decathlon. Each partner keeps a normal URL and an optional affiliate URL so Pace Yourself can prepare and test the user journey before an affiliate account is approved.

## Key Concepts

- Partner key: the stable `booking` or `decathlon` identifier.
- Standard URL: the non-affiliate HTTPS destination.
- Affiliate URL: an optional HTTPS destination supplied after approval.
- Resolved URL: null while the partner is disabled, otherwise the affiliate URL when affiliate mode is enabled, or the standard URL as fallback.

## Columns

| Column | Type | Notes |
| --- | --- | --- |
| `partner_key` | `text` | Primary key constrained to `booking` or `decathlon`. |
| `standard_url` | `text` | Required HTTPS URL. |
| `affiliate_url` | `text` nullable | Optional HTTPS affiliate/deep link. |
| `affiliate_enabled` | `boolean` | Requires a non-null affiliate URL when true. |
| `is_enabled` | `boolean` | Global availability gate for the partner. |
| `updated_at` | `timestamptz` | Server-written update timestamp. |
| `updated_by` | `uuid` nullable | Trusted admin actor, cleared if the Auth user is deleted. |

## Foreign Keys

- `updated_by references auth.users(id) on delete set null`.

## Indexes

- The primary key on `partner_key` is sufficient for the fixed two-row lookup and upsert.

## RLS Policies

RLS is enabled without client policies. `PUBLIC`, `anon`, and `authenticated` have no table privileges. Only `service_role` can select or mutate rows, and application routes must authenticate a trusted `app_metadata` admin before using that credential.

## Business Invariants

- Exactly the allowlisted Booking and Decathlon keys are accepted.
- URLs must use HTTPS and contain no whitespace.
- Affiliate mode cannot be enabled without an affiliate URL.
- The seed rows start disabled, so creating the table does not publish a commercial CTA.
- The two rows are saved in one PostgREST upsert to avoid partial partner configuration.

## Common Queries

The admin route reads both rows ordered by `partner_key` and upserts both rows together with `on_conflict=partner_key`. The public `/api/partner-links` route filters enabled rows server-side and exposes only the resolved active URL plus whether that resolved destination is affiliated; it never returns the alternative URL, rollout flags, timestamps, or `updated_by` audit field.

## Gotchas

- `affiliate_offers` remains the product-specific merchant-offer table. Do not use it for global Booking or Decathlon CTA configuration.
- Do not let mobile or browser clients query this table directly; affiliate destinations and rollout state remain server-mediated.
- Do not label a standard URL as affiliated while `affiliate_enabled` is false.
- Mobile failures must degrade to no partner CTA; they must never trigger a direct client query against this service-role-only table.

## Related Docs

- [Affiliate Partner Links](../../05-integrations/affiliate-partner-links.md)
- [Schema Overview](../schema-overview.md)
- [RLS Policies](../rls-policies.md)
