---
title: Public Race Discovery
scope: business-rule
last_verified: 2026-11-16
# Structured access phase (2026-11-15): public race pages summarize parking and shuttle collections without exposing each logistics record; historical text remains the fallback.
ai_priority: high
related_files:
  - apps/web/app/courses/supporter-guide/[raceId]/page.tsx
  - apps/web/app/courses/supporter-guide/[raceId]/SupporterGuideView.tsx
  - supabase/migrations/20260824164101_manage_organizer_edition_visibility_and_deletion.sql
  - supabase/migrations/20260828161008_add_race_slug_redirects.sql
  - supabase/migrations/20260910074418_add_normalized_race_event_geography.sql
  - supabase/migrations/20260910082051_backfill_catalog_race_event_geography.sql
  - supabase/migrations/20260910083131_correct_translantau_country_code.sql
  - supabase/migrations/20260910103118_enrich_catalog_through_may_2027.sql
  - supabase/migrations/20260923070437_separate_web_and_mobile_race_visibility.sql
  - supabase/migrations/20260923064926_backfill_public_race_event_website_urls.sql
  - supabase/tests/race_slug_redirects_checks.sql
  - supabase/tests/web_race_visibility_checks.sql
  - supabase/migrations/20261113200326_add_race_event_edition_slugs.sql
  - supabase/tests/race_event_edition_slug_redirects_checks.sql
  - apps/web/lib/public-races.ts
  - apps/web/lib/public-race-cache.ts
  - apps/web/lib/public-race-cache.test.ts
  - apps/web/lib/public-race-events.ts
  - apps/web/lib/public-race-events.test.ts
  - apps/web/lib/public-race-detail.ts
  - apps/web/lib/public-race-detail.test.ts
  - apps/web/lib/race-discovery.ts
  - apps/web/app/courses/page.tsx
  - apps/web/app/courses/catalog-query.ts
  - apps/web/app/courses/catalog-query.test.ts
  - apps/web/app/courses/[slug]/page.tsx
  - apps/web/app/courses/[slug]/race-structured-data.ts
  - apps/web/app/courses/[slug]/race-structured-data.test.ts
  - apps/web/app/courses/[slug]/race-time-estimates.ts
  - apps/web/app/courses/_components/RaceTimeEstimates.tsx
  - apps/web/app/courses/_components/RaceSectionTabs.tsx
  - apps/web/app/courses/_components/PublicHeroShell.tsx
  - apps/web/app/api/race-estimate/route.ts
  - apps/web/app/api/race-estimate/route.test.ts
  - apps/web/app/courses/evenements/[slug]/page.tsx
  - apps/web/app/courses/evenements/[slug]/event-structured-data.ts
  - apps/web/app/courses/evenements/[slug]/event-structured-data.test.ts
  - apps/web/app/courses/evenements/[slug]/event-edition-status.ts
  - apps/web/app/courses/evenements/[slug]/event-edition-status.test.ts
  - apps/web/app/courses/_components/RaceCatalogFilter.tsx
  - apps/web/app/courses/_components/RaceCatalogFilter.test.ts
  - apps/web/app/courses/_components/catalog-display.ts
  - apps/web/app/courses/_components/PublicRaceLinks.tsx
  - apps/web/app/courses/_components/PublicRaceShare.tsx
  - apps/web/app/courses/_components/PublicElevationProfile.tsx
  - apps/web/app/courses/_components/RaceHeroSummary.tsx
  - apps/web/app/courses/_components/RaceRouteExplorer.tsx
  - apps/web/app/courses/_components/RaceAidStationsTimeline.tsx
  - apps/web/app/courses/_components/RunnerAppBridge.tsx
  - apps/web/app/courses/_components/RaceLinksCarousel.tsx
  - apps/web/components/ui/accordion.tsx
  - apps/web/app/courses/PublicRaceShare.test.ts
  - apps/web/app/courses/distances/[category]/page.tsx
  - apps/web/app/courses/race-discovery.test.ts
  - apps/web/lib/public-races.test.ts
  - apps/web/app/courses/[slug]/page.test.ts
  - apps/web/app/courses/[slug]/race-metadata.ts
  - apps/web/lib/app-store.ts
  - scripts/audit-public-race-slugs.mjs
  - scripts/audit-public-race-slugs.test.mjs
  - scripts/optimize-supabase-race-images.mjs
related_tables:
  - race_events
  - races
  - race_slug_redirects
  - race_event_editions
  - race_event_edition_slug_redirects
---

# Public Race Discovery

Supporter Guide format identification (2026-11-15): each format gets a colour from the `colors.formats` token, assigned by increasing distance (same rule on app and web). Programme rows show a round badge in the format colour with a type icon (start ▶, expected arrival / last runner clock, podium trophy, animation by type), the moment label in that colour and a coloured dot before the race name; past rows turn grey with a check. The « Je suis » checkboxes and the Suivre / Pratique race tabs carry the same colour, acting as the legend. Animations keep the brand colour.

Supporter Guide course line endpoints (2026-11-15): `addCourseEndpoints` opens every `formats[].stops` line with a start stop (`endpoint: "start"`, km 0, `startTimes` — wave names only when there are several SAS — and start-area directions) and closes it with the finish (`endpoint: "finish"`: the organizer « Arrivée » checkpoint is enriched, otherwise a finish stop is added) carrying `expectedArrivals`, the resolved finish cutoff and finish directions. A single wave is never labelled (no « Départ commun ») in the programme either.

On the public Supporter Guide page the « Je suis » checkboxes filter the programme only; fully past days are dimmed and collapsed (expandable) by default.

The Supporter Guide timeline adds `arrival_estimate` entries (official start + estimated winning time, `audience` men/women, multi-day aware) and event-wide `animation` entries (`eventWide`, `endTime`, `animationType`) shown whatever races are followed; Programme gains an Animations tab and the Arrivées tab groups expected first arrivals with the last-runner finish cutoff.

The public Supporter Guide page offers type tabs, a « Je suis » race filter, the live race-day markers and one card per place (ravito + cheering points merged).

Course page time estimates (2026-11-16): `/courses/[slug]` shows « Combien de temps pour finir … ? » with three reference levels (comfortable flat pace 5:00, 6:30 and 8:00 /km) computed by `buildReferenceEstimates` with the planner effort model (`quick-estimate.ts`, see Pacing Algorithm). They are published only when the format has a known distance **and** D+, are labelled as Pace Yourself estimates excluding pauses, and never replace official cutoffs. The fastest–slowest range is reused in the meta description and the `SportsEvent.description`, so the snippet and the page show the same figures. This is the only derived duration the page may show; difficulty, weather and other facts still must not be generated.

Account-free estimate (2026-11-16): `POST /api/race-estimate` (`catalogRaceId` + comfortable flat pace and/or UTMB Index, IP rate-limited 20/min) re-resolves the race through `getPublicRaces` and `getPublicRaceDetail`, so the same web-public gates apply. It returns only aggregated times (total, average pace, per-ravito elapsed time) — never route points, coordinates or the GPX. The planner uses it for anonymous visitors arriving from a course page in runner mode.

Event JSON-LD references (2026-11-16): Search Console reported nested Events missing `startDate`, `organizer`, `eventStatus`, `offers`, `endDate` and `image`. A format's `superEvent` and an edition's `subEvent` entries are now bare `{"@id": "<canonical url>#event"}` references to the complete `SportsEvent` each page publishes, so Google no longer validates partial nested Events. Every emitted `SportsEvent` has an `image` (format/event image, otherwise the absolute shared social image), and the edition `Place` adds a `PostalAddress` from the formats' normalized parent-event city/region/country when available. `performer` stays absent: no verified performer exists for a race.

Catalog and event page layout (2026-11-16): `/courses` uses a compact header, horizontally scrolling distance-selection pills, a compact GET form (sticky only from `lg`) and a 1/2/3-column grid of event cards. Each card shows the veiled event image (or a brand header), edition year, format count, date and location, then up to three format rows (distance badge, label, D+, date when formats differ); further formats stay in the HTML behind a native `<details>`. Inside an event context the row label drops a leading copy of the event name (`getFormatLabelWithinEvent`, display only; the link `title` keeps the full name). `/courses/evenements/[slug]` reuses `PublicHeroShell` (formats, distance range, max D+, day count), lists formats sorted by distance with a stopwatch link to the account-free estimate for each, then common information, app bridge and the factual overview.

Course page layout (2026-11-16): app-style hero (veiled photo carrying event/name/date/location, horizontally scrollable metric strip — distance, D+, D−, departure, cutoff, ravitos, max altitude — then the estimate CTA and the registration link), a sticky section tab bar (`RaceSectionTabs`), the reference times, route/profile, ravitos, practical information, app bridge, a compact carbohydrate-calculator link, « À propos » overview, discovery and official links. A fixed bottom estimate CTA is shown below `lg`. `RaceMetricsDetails` is removed: its D−/altitude values live in the hero strip. On mobile the page relies on the RootChrome horizontal padding only.

The web Supporter Guide programme is grouped by calendar day from the server `timeline`, with localized dates/distances and cutoffs labelled with their weekday when they fall after the race day.

`/courses/supporter-guide/[raceId]` is the public, mobile-first Livret accompagnateur route. It is intentionally `noindex`, uses the same publication cache tags as RaceBook output, and returns unavailable when no visible format has a current immutable publication. Its UUID selects the edition; the payload may include every public, preview-visible published format in that edition.

The public course practical section may show `thirdPartyPickupConditions` only when the bib-pickup module is public and third-party pickup is allowed. This additive copy does not participate in catalog eligibility, search, canonical identity, slug resolution, ISR visibility, or structured-data selection.

## Purpose

This document defines which public race pages Pace Yourself may expose to search engines and how the catalog creates useful internal links without inventing missing race facts.

## Key Concepts

- Web-public race: a `races` row where both `web_catalog_is_live` and `is_public` are true, under a live optional parent event.
- Mobile-visible edition: a `race_event_editions` row whose `is_visible` flag permits attached formats to participate in mobile course/RaceBook discovery; it does not remove an already published web page.
- Event edition format: another public race attached to the same non-null `event_id + edition_id`; legacy rows without an edition fall back to `event_id`.
- Similar race: a race from another event ordered by distance difference, then elevation difference when both elevations exist.
- Indexable selection: a deterministic landing page based only on structured fields and containing at least five public races.
- Normalized geography: explicit country, region, department and city fields, not a region guessed from `location` or `location_text`.
- Former slug: a durable `race_slug_redirects.old_slug` mapping to the stable race id.
- App bridge: the public course page may promise the Livret coureur only when `racebook_is_live` is true and the attached edition is mobile-visible; otherwise it uses generic app preparation copy.
- Former slug: a durable format or event-edition redirect mapping to a stable row id.

## Public Race Detail Pages

Grouped event cards use the earliest and latest valid format dates for a compact French date range. A single shared valid date keeps the full date; a partially undated group stays explicit instead of implying that every format is dated. Different format locations collapse to the normalized common event city when one is available, otherwise to the number of distinct known departure labels. Each format row still prints its own date and location, including an explicit confirmation placeholder for missing facts.

The lightweight catalog contract allowlists the parent event's canonical `race_events.website_url` alongside the format's `races.external_site_url`. The primary `S’inscrire` action uses the event website first, falls back to the format URL for a standalone or missing-event link, opens in a new tab, and is omitted unless the selected value is HTTP(S). The same rule applies to the course hero and the existing official-source list without exposing raw organizer JSON.

Each current public slug resolves to `/courses/[slug]`. A known former slug reloads the target through the same current visibility checks, emits canonical metadata for the current URL, then returns a permanent redirect. Unknown mappings and targets that are no longer public remain not found and noindex.

The dynamic route returns no build-time parameters. The first request for a current or former slug generates the route through ISR, then the normal 15-minute page revalidation applies. This prevents a deployment from replaying every public race detail query and private GPX read while the sitemap continues to expose every canonical URL.

The lightweight `PublicRace` catalog contract contains identity, `eventId`, `editionId`, format/event image URLs, date, display location, normalized city/department/region/country labels, an allowlisted array of searchable location labels, distance, D+, slug, the format official URL, and the parent event website used by the registration CTA. Searchable labels come only from the format's two public location strings and the parent event's public location, city, department, region, and country; codes, coordinates, organizer JSON and operational fields stay outside the client DTO. Its server-only, explicit-column service read requires `races.web_catalog_is_live`, `races.is_public`, and a live optional parent event; it deliberately does not consult mobile edition visibility or broaden direct client RLS. The separate server-only `PublicRaceDetail` repeats those web gates before reading organizer details, edition dates, ravitos, or the private GPX. It maps only the runner-facing fields required by the page and never serializes either raw organizer JSON object. In particular, the event emergency contact and `services.lastMinuteMessage` are excluded from the DTO even when present in the stored event data.

The detail page applies the established event/format inheritance parser for schedule, equipment, bib pickup, access, runner information and services. Before serializing practical content, it also requires `racebook_is_live` and applies the effective edition/module entitlement, including active edition capability grants. Those public entitlement, grant, and module-setting reads participate in the same 15-minute ISR data-cache window as the other detail reads; they must never reuse the private Organizer `no-store` loaders and turn an already static course route dynamic during revalidation. Higher-tier drafts and disabled modules therefore remain private even while the catalog identity page stays public.

Aid stations have a narrower public summary contract. Every web-public format may expose only station id, name, kilometer, and the water/solid flags, even without an Organizer offer or a published Livret coureur. Detailed cutoff, altitude, cumulative elevation, assistance, drop-bag, note, relay, and product information remains absent from the server payload unless the Livret is published and the effective `aid_stations` module is active. An explicit race-level `aid_stations = false` setting removes both summary and details. When only the summary is available, the page keeps the route/profile markers and ordered timeline, then links to the app without promising unpublished detail.

Outside that summary exception, the loader exposes only available covered values, D+/D-, altitude bounds, participation mode, format then event official websites, and event social profiles. It must not generate course difficulty, expected duration, weather, aid-station values, or other claims from absent source data.

When a private GPX object exists, the server downloads and parses it only after every visibility gate succeeds. The browser receives a bounded route/elevation preview of about 600 points, never the GPX file or Storage path. Invalid or absent GPX degrades to a detail page without map/profile, and the public page offers no GPX download action.

The page always exposes `BreadcrumbList` structured data and exposes `SportsEvent` only when the format has a valid calendar `startDate` in strict `YYYY-MM-DD` form. Its `Place` may use the verified start label, start coordinates, start-address string, and normalized parent city/region/country; unavailable postal components are omitted and a place name is never inserted into `PostalAddress`. `eventStatus` is `EventScheduled` because the current schema has no cancellation/postponement status. The organizer is the known event identity (falling back to the format identity) with its official HTTP(S) website when available. The registration action becomes an `Offer` containing only its URL; price, currency, and availability remain absent because the catalog does not store them.

`endDate` remains the same date for a single-day edition. A later canonical edition end is emitted only when unambiguous stored start and finish-cutoff clocks prove an overnight format by wrapping past midnight; prose or incomplete clocks cannot establish that fact. Formats attached to a slugged edition emit a `superEvent` reference to its canonical event page. Open Graph and Twitter use the format image first, the event image second, and the shared Pace Yourself social image last. SEO titles are capped at 60 characters, reserve a factual distance/year suffix, and truncate the middle of long names so both the event prefix and distinguishing format suffix survive; when the full name fits, a distance already present in the name is not repeated and a « · temps & ravitos » hook is appended if it still fits. Descriptions are capped at 160 characters and end with the reference time range (or a generic estimate invitation when no range can be computed). It links to:

- other published formats sharing the same event edition, with the legacy event-only fallback when `edition_id` is absent;
- up to three published races from other events with the nearest distance, using elevation only as a tie-breaker;
- the planner at `/race-planner?catalogRaceId=<race-id>` (hero, reference-times block, desktop aside and mobile fixed bar) and the carbohydrate calculator;
- distinct format/event official sources and available official event social profiles.

Sharing uses the native Web Share sheet when available, which lets installed mobile apps such as Instagram participate. Facebook remains a direct action, copy is always explicit, and the main action falls back to copy when Web Share is unavailable. Native cancellation does not trigger a surprise copy. Missing Clipboard support falls back to the browser copy command and reports success/failure through an accessible live status.

## Catalog Event Grouping

Every public edition with at least one web-public format has one canonical `/courses/evenements/[slug]` page. It lists only that edition's public formats (sorted by distance), their factual distance, D+, date and ravito count, and sanitized practical information inherited from the event. It emits one parent `SportsEvent` whose `subEvent` entries are `@id` references to the format pages. Former edition slugs permanently redirect after the current event and format visibility gates are rechecked. The sitemap deduplicates event-edition URLs and uses the newest edition, event, or format timestamp available; station rows currently have no `updated_at`, so station-only changes cannot improve `<lastmod>` evidence.

Historical edition pages remain indexable and canonical. After the inclusive `end_date` has passed in Europe/Paris, they show an “Édition terminée” banner; if the same event has a later edition with at least one web-public format, the banner links directly to it. An already-published later edition is also highlighted from a non-past page.

Each event-edition header exposes one registration action (« S’inscrire sur le site officiel ») sourced from the shared event website, after the primary « Estimer mon temps » jump to the format list. Distance-selection cards use the same target, while standalone cards fall back to the format URL and retain a separate internal course-detail link.

The `/courses` catalog groups published formats by stable non-null `event_id + edition_id`. Historical rows with an event but no edition fall back to `event_id`; a display name is never an identity and two homonymous events remain separate. Each standalone race with no event id stays in its own card. Formats are ordered by numeric distance with unknown values last.

The default temporal filter contains upcoming/current formats followed by undated formats. Past formats are available separately and sorted newest first; the `Toutes` view keeps upcoming, undated, then past. Search is accent- and punctuation-insensitive, matches every entered token regardless of order, and covers format/event names plus every allowlisted format and normalized parent-event locality. It combines with distance and temporal filters through a server GET form. Visible result counters and a reset action describe the active state.

Filtering happens before grouping, so an event-edition card disappears when none of its formats matches. Every visible format remains a normal HTML link to `/courses/[slug]`, including formats collapsed behind the card's « autres formats » disclosure. Event-edition cards use the shared event image and year/date where available; standalone formats use their own image. A format image remains the first detail-page image choice. Missing images reserve no empty visual area. The responsive card layout stacks at narrow widths, keeps controls at least 44 px high and avoids horizontal tables.

The catalog paginates on the server at 12 event-edition groups per response and emits an `ItemList` only for the visible page, with positions continuing across pages. The full public race collection is never serialized into a client component. Unfiltered numbered pages have self-canonicals and crawlable previous/next links; out-of-range pages return not found. Search, distance, and period query combinations are `noindex,follow` and canonicalize to `/courses`, preventing a filter-index explosion while preserving discovery links.

## Prefiltered Landing Pages

Distance pages use three mutually exclusive structured ranges:

- `trail-court`: less than 30 km;
- `trail-30-79-km`: at least 30 km and less than 80 km;
- `ultra-trail`: at least 80 km.

A page is generated and indexable only while at least five public races have a numeric distance in its range. Below that threshold it is omitted from generated parameters, navigation and metadata indexation, and the route returns not found.

## Geographic Landing-Page Guardrail

`race_events` now has explicit normalized city, department, region and country names/codes plus an anchor-city coordinate pair. All current live events have a verified country; after the March–May 2027 organizer-source batch, 46 French events have complete commune, department, region and coordinate enrichment. The 50 remaining official UTMB international events intentionally stay country-only until one unambiguous locality is verified.

The 2027 extension publishes 15 organizer-verified formats across the Trail du Petit Ballon, Grand Trail des Cadourques, and Volvic Volcanic Experience. It reuses the existing Volvic event, corrects its parent anchor while preserving the 2026 XGTV route label, creates canonical visible 2027 editions, and keeps unpublished D+ values null.

Regional and departmental landing pages are not enabled yet. When introduced, they must use stable normalized codes from the parent event, apply the same five-race minimum-content threshold, and include only public formats under live events. Free-text `location`/`location_text`, postal-code guesses and runtime city-to-region lookup remain unacceptable sources of truth.

Nearby-city discovery may use the stored event anchor coordinates as an approximate straight-line prefilter. It must be labelled accordingly and must not imply route distance or that a multi-city trail lies wholly inside the anchor municipality.

Country filters may include country-only rows. City, department, region and nearby-city filters must require their corresponding normalized code or coordinate fields and must never fall back to the display label.

## Slug Stability

Existing race slugs remain canonical until a rename is explicitly approved. The durable mapping and permanent redirect contract now exists: the database trigger records every former slug against the stable race id, and the web route resolves directly to the current canonical slug without redirect chains.

Edition slugs follow the same no-chain rule through `race_event_edition_slug_redirects`, but remain a separate namespace and service-only table. `rename_race_event_edition_slug` is the trusted atomic rename boundary.

`scripts/audit-public-race-slugs.mjs` is the review-only preparation step. It reads published catalog data with an anon/publishable key, refuses elevated keys, reports technical slugs and deterministic French-readable proposals, resolves candidate collisions with location then a stable id suffix, and performs zero writes. A proposal is not authorization to rename; approved changes must use the service-only atomic RPC after the migration is deployed.

## Gotchas

- Keep nested `subEvent`/`superEvent` as bare `@id` references. Adding `@type` or a name back turns them into partial Events that Search Console flags (missing `startDate`, `organizer`, …).

- Reference times and the account-free estimate are derived from distance/D+/D− and the downsampled preview profile scaled to the official totals. Do not show them when distance or D+ is missing, and never return preview points from `/api/race-estimate`.
- `generateMetadata` reads the same cached detail as the page to build the snippet range; a failed detail read falls back to the generic description, it must not 404 the metadata.

- The `/courses` index renders inside the single `RootChrome` main landmark. Its route root is a `<div>`; this semantic cleanup does not change catalog visibility, grouping, query canonicalization or ISR.

- Keep the registration target event-first and HTTP(S)-only. Do not expose raw organizer JSON or silently turn an unvalidated string into an outbound link.
- Keep catalog/detail visibility on the 15-minute public window. The raw GPX object may remain in the persistent data cache for one year only because every replacement writes a new Storage path; never overwrite or reuse a published GPX path.
- Public reads must retain the `public-races` cache tag. Successful organizer/admin writes that can change catalog identity, publication, event/edition content, images, or ravitos invalidate it together with the applicable `public-race:*`, `public-edition:*`, and `public-event:*` tags; failed writes invalidate nothing.
- Web course discovery uses `races.web_catalog_is_live` / `races.is_public` and live parent events. Mobile discovery continues to use `is_live`, `racebook_preview_is_visible`, and edition visibility; `racebook_is_live` independently protects practical RaceBook modules.
- First public/mobile publication promotes `web_catalog_is_live`. Later format-private, masked, or edition-hidden transitions may clear the mobile/RaceBook flags but preserve the factual web page and its slug redirects. Setting `is_public = false` clears web visibility, and deleting an edition still cascades its formats.
- Keep catalog, slug resolution, sitemap, detail, and private-GPX preview on the shared 15-minute public-race revalidation window. A longer negative detail cache can otherwise outlive a catalog refresh and expose a temporary crawlable 404.

- Do not count races with missing distance toward a distance landing page.
- Do not present another format from the same event as a similar independent race.
- Do not group catalog rows by `eventName`, course name, or location; only stable `eventId + editionId`, with the documented legacy `eventId` fallback, may merge formats.
- Do not serialize raw organizer JSON, emergency phone data, `lastMinuteMessage`, GPX Storage paths, or full GPX content into public client components.
- Similarity is a navigation aid, not a statement that courses have comparable terrain or difficulty.
- Do not expose a thin landing page merely because its URL pattern exists; the five-race threshold is part of the indexation contract.
- Do not derive regions or departments from display-location strings; exclude null normalized values from exact geographic filters.
- Do not publish thin region/city SEO pages merely because a normalized field exists. Geographic indexation still requires the five-race threshold and useful unique content.
- Keep all public queries restricted to explicit columns and published rows.
- Never reuse a former slug for another race. It remains reserved in `race_slug_redirects` while the target race exists.
- Do not run a slug migration from the dry-run script; it deliberately has no write path.

## Related Docs

- [Web App](../01-architecture/web-app.md)
- [race_events](../02-database/tables/race-events.md)
- [race_slug_redirects](../02-database/tables/race-slug-redirects.md)
- [Organizer Race Management](organizer-race-management.md)
