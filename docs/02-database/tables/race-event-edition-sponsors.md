---
title: race_event_edition_sponsors Table
scope: database
last_verified: 2026-08-30
ai_priority: high
related_files:
  - supabase/migrations/20260829204018_add_racebook_edition_sponsors.sql
  - supabase/migrations/20260829204032_seed_trail_tst_sponsors.sql
  - supabase/tests/racebook_sponsors_checks.sql
  - apps/web/lib/racebook-sponsors.ts
  - apps/web/app/api/organizer/editions/[id]/sponsors/route.ts
  - apps/web/app/api/organizer/editions/[id]/sponsors/[sponsorId]/route.ts
  - apps/web/app/api/organizer/editions/[id]/sponsors/route.test.ts
  - apps/web/app/api/organizer/editions/[id]/sponsors/[sponsorId]/route.test.ts
  - apps/web/app/api/racebook-sponsors/route.ts
  - apps/web/app/api/racebook-sponsors/[id]/click/route.ts
  - apps/web/app/api/racebook-sponsors/route.test.ts
  - apps/web/app/api/racebook-sponsors/[id]/click/route.test.ts
  - apps/web/app/organizer/_components/dashboard/sponsors-editor.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/lib/racebookSponsors.ts
  - apps/mobile/lib/racebookSponsorPresentation.ts
related_tables:
  - race_event_edition_sponsors
  - race_event_editions
  - races
---

# race_event_edition_sponsors

## Purpose

`race_event_edition_sponsors` stores sponsor presentation and one aggregate redirect counter for a canonical event edition. Every format attached to the edition reuses the same ordered sponsors.

## Columns

| Column | Rules | Meaning |
| --- | --- | --- |
| `id` | UUID primary key | Sponsor identifier. |
| `edition_id` | FK to `race_event_editions`, cascade delete | Shared edition scope. |
| `name` | trimmed, 1–80 characters | Native UI label; logos do not need embedded text. |
| `logo_url` | required HTTP(S) URL | Public raster logo in `race-images`. |
| `website_url` | nullable HTTP(S) URL | Redirect target; absent means non-clickable. |
| `is_active` | boolean | Master visibility switch. |
| `show_on_loading` | boolean | Eligible for the sponsor loading composition. |
| `show_in_banner` | boolean | Eligible for the compact RaceBook banner. |
| `position` | integer 0–9 | Edition display order. |
| `click_count` | non-negative bigint | Aggregate raw redirect openings only. |
| `created_at`, `updated_at` | timestamps | Audit fields. |

An active row needs at least one placement. A transaction-serialized trigger enforces at most ten rows per edition and at most two active loading rows, including concurrent writes.

## Security and Access

RLS is enabled and `anon` / `authenticated` receive no table privileges or policies. Organizer and mobile clients use Next.js routes; those routes verify the Supabase session and active parent-event membership when required, then use `service_role`.

The public presentation route returns only active rows after the normal public RaceBook gate, with an active organizer preview exception. It exposes a server redirect URL instead of `website_url`. The redirect route validates the sponsor/race edition pair, rate-limits counting by sponsor plus a hashed network identifier, invokes `increment_racebook_sponsor_click` atomically, and redirects even when counting fails.

No impression, runner id, network identifier, or individual click history is stored. `click_count` represents raw openings, not unique visitors.

## Storage

Organizer logos use `race-images/organizer-sponsors/{editionId}/` and accept PNG, JPEG, WebP, or AVIF up to 5 MB. Replacement, sponsor deletion, edition deletion, and event deletion remove the prior Storage object after the database mutation succeeds.

The fictitious Trail TST assets are reproducible under `supabase/demo-assets/sponsors/`, uploaded to `race-images/trail-tst/2026/sponsors/`, and seeded idempotently for edition `7a110000-0000-4000-8000-000000000002`.

## Mobile Presentation

The RaceBook reserves one unified loading panel with two vertical logo slots while the sponsor lookup is pending. The slots share one surface with a subtle divider and occupy roughly one third of the available viewport beneath a compact localized title and animated runner trail. An empty or failed lookup removes the panel and does not activate the 2.5-second sponsor gate. This loading state temporarily hides feedback and the bottom tab bar, but keeps the native back/title header and restores normal navigation before content appears. The presentation does not add impression tracking or expose direct destination URLs.

Banner placements use an automatic horizontal carousel whenever at least two active sponsors exist. It presents one sponsor per viewport-sized slide for three seconds, transitions over 520 ms, and loops through a duplicate first slide; reduced-motion users receive the manual horizontal list instead. The carousel still preserves database order, the ten-sponsor cap, and counted redirect links.

## Gotchas

- Do not query this table directly from mobile or browser code.
- Do not expose `website_url` through the presentation payload; preserve the counted redirect boundary.
- Sponsor configuration is not Pro-gated, but runners see it only when the selected RaceBook is accessible.
- Keep loading sponsors ordered and capped at two on both the route and mobile normalization layers even though the database trigger also enforces the invariant.
- Keep the mobile loading panel and its two slots reserved until the lightweight lookup settles so logo arrival does not reflow the whole loading screen.
- Keep the compact banner carousel independent from aggregate row-width measurement; every active banner sponsor must rotate even when several logos could technically fit at once.
- Keep sponsor timing independent from route-local `Accès` expansion state; opening a parking or shuttle row must not restart the banner or sponsor gate.

## Related Docs

- [race_event_editions](race-event-editions.md)
- [RLS Policies](../rls-policies.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
- [Mobile App Architecture](../../01-architecture/mobile-app.md)
