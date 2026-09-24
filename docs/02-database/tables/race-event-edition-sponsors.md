---
title: race_event_edition_sponsors Table
scope: database
last_verified: 2026-09-24
ai_priority: high
related_files:
  - supabase/migrations/20260829204018_add_racebook_edition_sponsors.sql
  - supabase/migrations/20260924093224_add_racebook_sponsor_presentation_analytics.sql
  - supabase/migrations/20260829204032_seed_trail_tst_sponsors.sql
  - supabase/tests/racebook_sponsors_checks.sql
  - supabase/migrations/20260910081049_add_atomic_organizer_course_collections.sql
  - apps/web/lib/racebook-sponsors.ts
  - apps/web/lib/organizer-entitlements.ts
  - apps/web/app/api/organizer/editions/[id]/sponsors/route.ts
  - apps/web/app/api/organizer/editions/[id]/sponsors/[sponsorId]/route.ts
  - apps/web/app/api/organizer/editions/[id]/sponsors/route.test.ts
  - apps/web/app/api/organizer/editions/[id]/sponsors/[sponsorId]/route.test.ts
  - apps/web/app/api/racebook-sponsors/route.ts
  - apps/web/app/api/racebook-sponsors/[id]/click/route.ts
  - apps/web/app/api/racebook-sponsors/route.test.ts
  - apps/web/app/api/racebook-sponsors/[id]/click/route.test.ts
  - apps/web/app/api/racebook-sponsors/impression/route.ts
  - apps/web/app/api/racebook-sponsors/impression/route.test.ts
  - apps/web/app/organizer/_components/dashboard/sponsors-editor.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/components/racebook/RacebookSponsorExperience.tsx
  - apps/mobile/lib/racebookSponsors.ts
  - apps/mobile/lib/racebookSponsorPresentation.ts
  - apps/web/lib/racebook-branding.ts
related_tables:
  - race_event_edition_sponsors
  - race_event_edition_branding
  - race_event_editions
  - races
---

# race_event_edition_sponsors

## Purpose

`race_event_edition_sponsors` stores sponsor presentation plus aggregate click and viewable-impression counters for a canonical event edition. Every format attached to the edition reuses the same ordered sponsors.

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
| `impression_count` | non-negative bigint | Accepted aggregate viewable presentations only. |
| `partnership_level` | `principal`, `official`, or `service` | Visual and commercial hierarchy. |
| `category` | nullable trimmed text, 1-60 characters | Optional organizer-authored partner role. |
| `contextual_placement` | `none`, `aid_stations`, `equipment`, `access`, or `services` | Optional exact RaceBook section placement. |
| `created_at`, `updated_at` | timestamps | Audit fields. |

An active row needs at least one loading, hero/banner, or contextual placement. A transaction-serialized trigger enforces at most ten rows per edition and at most two active loading rows, including concurrent writes.

## Security and Access

RLS is enabled and `anon` / `authenticated` receive no table privileges or policies. Organizer and mobile clients use Next.js routes, then the routes use `service_role`. Organizer draft reads and mutations require active parent-event membership plus a selected sponsor module; Signature remains required for runner-visible placements and partner behavior.

The public presentation route returns only active rows after the normal public RaceBook gate, with an active organizer preview exception. A format explicitly masked through `racebook_preview_is_visible = false` receives no payload even for an organizer. It exposes hierarchy, category, contextual placement, and a server redirect URL instead of `website_url`; aggregate counters stay organizer-only. The redirect route validates the sponsor/race edition pair, rate-limits counting by sponsor plus a hashed network identifier, invokes `increment_racebook_sponsor_click` atomically, and redirects even when counting fails.

`POST /api/racebook-sponsors/impression` accepts a race id, sponsor id, random view UUID, and exact `loading`, `hero`, `aid_stations`, `equipment`, `access`, or `services` placement. It verifies the active module and configured placement, applies ephemeral in-process sponsor/placement/view deduplication plus a global anti-abuse ceiling, then invokes the service-only `increment_racebook_sponsor_impression` RPC. The RPC repeats the sponsor/race-edition, explicit-preview, publication, and placement checks before incrementing. Only aggregate counters persist: no runner id, network identifier, view id, or individual click/impression history is stored. Counts are raw accepted presentations/openings, not unique visitors.

## Storage

Organizer logos use `race-images/organizer-sponsors/{editionId}/` and accept PNG, JPEG, WebP, or AVIF up to 5 MB. Replacement, sponsor deletion, edition deletion, and event deletion remove the prior Storage object after the database mutation succeeds.

The fictitious Trail TST assets are reproducible under `supabase/demo-assets/sponsors/`, uploaded to `race-images/trail-tst/2026/sponsors/`, and seeded idempotently for edition `7a110000-0000-4000-8000-000000000002`.

## Mobile Presentation

The same backward-compatible `/api/racebook-sponsors` response carries the edition's resolved published `branding` object beside sponsor arrays. The published edition logo is independently resolved from sponsor slots and remains separate from click reporting. Missing/unpublished branding resolves to Pace Yourself color defaults without changing sponsor behavior.

The Courses sheet starts a short-lived, account-scoped sponsor request and logo warmup immediately before navigating to a RaceBook. The destination reuses that in-flight/cached request, holds visible progress at its initial position until loading logos are ready, then starts the normal animation with sponsors already displayed. Direct links keep the same lookup and logo-prefetch fallback. The RaceBook reserves one unified loading panel with two vertical logo slots while that preparation is pending. The slots share one surface with a subtle divider and occupy roughly one third of the available viewport beneath a compact localized title and animated runner trail. An empty or failed lookup removes the panel and does not activate the 2.5-second sponsor gate. This loading state temporarily hides feedback and the bottom tab bar, but keeps the native back/title header and restores normal navigation before content appears.

The former 44dp carousel is replaced by a stable `Partenaires officiels` surface. It keeps ordered active placements visible simultaneously, with 56â€“80dp logos, a visible `DÃ©couvrir` redirect affordance, and optional `principal`, `official`, and `service` hierarchy. The public payload can also provide `contextualSponsors`: composable RaceBook sections filter that collection by `aid_stations`, `equipment`, `access`, or `services`; older responses safely fall back to `bannerSponsors`. The title-partner surface derives its fill, border, and CTA from the resolved edition theme rather than Pace Yourself green.

RaceBook product analytics now measure reader opens, tabs, non-sponsor actions, and foreground active duration. Sponsor identities and redirect presses remain excluded from that person-level stream. Sponsor surfaces report aggregate viewability through the dedicated endpoint only after the surface is actually presented; the per-mount callback carries sponsor id, exact placement, and tier, while the transport adds race id and one random view UUID. A caller must not attach a runner identity or destination URL.

The two-line clamp for bib-pickup address links is independent from sponsor layouts, timing, redirects, and click counting.

## Gotchas

- The 2026-09-14 iOS accessibility pass changes only mobile input, gesture, and motion presentation; sponsor placement eligibility, redirect counting, payload filtering, and storage contracts remain unchanged.
- Sponsor eligibility depends on the effective Signature tier, not whether its origin is Admin, Offert, Stripe, or virement.
- The separate `racebook_analytics.view` complimentary capability never unlocks sponsor authoring or presentation; `sponsors.manage` remains Signature-only.

- Sponsor ordering sends the complete edition list to `reorder_racebook_sponsors`. The function locks the edition and rejects partial lists, foreign ids, duplicate ids or duplicate positions before updating any row.
- Public placement responses are edge-cached only for fully published RaceBooks. Sponsor create, edit, reorder, logo replacement, and delete invalidate the edition tag; the mobile 2.5-second loading placement remains intentional even on a cache hit.

- The destination waits for the lightweight sponsor/module/branding response before revealing RaceBook content. Do not restore a short UI timeout that commits defaults while the valid edition response is still in flight.
- The RaceBook onboarding guide is layered over the existing screen after loading; it does not replay, bypass, or alter sponsor lookup, timing, placement, or click counting.
- Do not merge organizer branding with sponsor rows, placements, or click counters merely because the lightweight payload transports both.

- Do not query this table directly from mobile or browser code.
- Do not expose `website_url` through the presentation payload; preserve the counted redirect boundary.
- Sponsor configuration is available as a private draft without Signature. The runner bootstrap returns no placements while the module is inactive or `draftOnly`; stored rows and aggregate click totals remain intact for restoration.
- Sponsor eligibility depends on the effective Signature tier, not whether its entitlement source is Stripe, a manual payment, or a complimentary admin grant.
- Keep loading sponsors ordered and capped at two on both the route and mobile normalization layers even though the database trigger also enforces the invariant.
- Keep the mobile loading panel and its two slots reserved until the lightweight lookup settles so logo arrival does not reflow the whole loading screen.
- Keep the sponsor handoff cache short-lived and scoped by authenticated user id plus race id. It may share one in-flight request across the catalog and destination, but must not reuse an organizer-only draft response after a session change.
- Treat loading as bonus visibility. The stable hero/partner block is the principal sponsor surface and must not depend on the transient loading interstitial.
- Keep sponsor timing independent from route-local expansion state; opening a parking, shuttle, or ravito accordion row must not restart the banner or sponsor gate.
- The extracted access, ravito and structured Course components remain below the route-owned sponsor gate and do not read or mutate sponsor presentation state.
- Do not add sponsor ids or names to identified RaceBook engagement events. Sponsor performance remains a separate aggregate click/impression contract.
- Keep `contextualSponsors` fallback-compatible with `bannerSponsors`; a partner configured only for a contextual surface must not disappear for clients that receive the new collection.
- Keep impression placement exact: `hero` maps to `show_in_banner`; contextual values must equal `contextual_placement`; `loading` maps only to `show_on_loading`.
- The RaceBook contextual bottom bar and hero social rail are app navigation/contact surfaces, not sponsor placements. They do not emit sponsor impressions or alter the stable hero partner block.
- Dismissing a RaceBook to Courses, including through Android hardware back, closes the current reader session but does not create a sponsor click or impression.
- The emergency number/action added to the expanded hero and its compact telephone icon are event contact surfaces, not sponsor placements. They neither affect viewability measurement nor share sponsor click/impression reporting.
- Official partners use compact three-column cards in the stable partner block. This density change does not alter ordering, tier eligibility, click redirects, viewability thresholds, or aggregate impression counting.
- The loading runner has no opaque backing tile: it moves directly above the progress track, including for a customized edition theme. This polish change does not affect the sponsor gate or impression timing.
- The account-owned Material checklist and broader decorative use of edition accent colors do not create sponsor impressions or mutate sponsor placement.

## Related Docs

- [race_event_editions](race-event-editions.md)
- [RLS Policies](../rls-policies.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
- [Mobile App Architecture](../../01-architecture/mobile-app.md)
