---
title: Public Race Discovery
scope: business-rule
last_verified: 2026-11-23
# Event hubs and landing pages (2026-11-22): permanent year-free event hubs (race_events.slug) are the indexable event pages and edition pages canonicalize to them; region (INSEE code) and month landing pages join the distance pages, all upcoming-only, paginated, ItemList, five-format minimum.
# Business card QR (2026-11-18): ?src=carte on the guide page redirects to /carte-visite (app on Android, Google Play / App Store listing otherwise).
# Livret supporter private preview (2026-11-18): the client guide page retries with the stored session token so an active organizer previews a private edition; public behavior unchanged.
# Shared-plan app gate (2026-11-17): app-store.ts gains detectMobileAppPlatform for the public crew page; course-page app bridge behavior is unchanged.
# Structured access phase (2026-11-15): public race pages summarize parking and shuttle collections without exposing each logistics record; historical text remains the fallback.
ai_priority: high
related_files:
  - apps/web/app/courses/evenements/[slug]/suivre/page.tsx
  - apps/web/lib/public-supporter-guide.ts
  - apps/web/lib/public-supporter-guide.test.ts
  - apps/web/app/livret-coureur/page.tsx
  - scripts/demo-gpx/generate-trail-tst-gpx.mjs
  - scripts/demo-gpx/upload-trail-tst-gpx.mjs
  - apps/web/app/livret-supporter/page.tsx
  - apps/web/components/landing/LivretProductPage.tsx
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
  - apps/web/app/courses/_components/catalog-display.test.ts
  - apps/web/app/courses/_components/DemoRaceBadge.tsx
  - apps/web/app/courses/_components/StickyEstimateBar.tsx
  - apps/web/lib/demo-race.ts
  - apps/web/app/sitemap.ts
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
  - apps/web/app/courses/distances/[category]/[[...page]]/page.tsx
  - apps/web/app/courses/regions/[region]/[[...page]]/page.tsx
  - apps/web/app/courses/mois/[month]/[[...page]]/page.tsx
  - apps/web/app/courses/_components/RaceLandingPage.tsx
  - apps/web/lib/race-landing-pages.ts
  - apps/web/lib/race-landing-pages.test.ts
  - apps/web/app/courses/evenements/[slug]/EventEditionSections.tsx
  - apps/web/app/courses/evenements/[slug]/event-hub.ts
  - apps/web/app/courses/evenements/[slug]/event-hub.test.ts
  - supabase/migrations/20261122230000_add_race_event_slugs_and_region_codes.sql
  - supabase/tests/race_event_slugs_checks.sql
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

Course page layout (2026-11-16, metric strip and sticky bar updated 2026-11-22): app-style hero (veiled photo carrying event/name/date/location, metric strip — distance, D+, D−, departure, cutoff, ravitos, max altitude — then the estimate CTA and the registration link), a sticky section tab bar (`RaceSectionTabs`), the reference times, route/profile, ravitos, practical information, app bridge, a compact carbohydrate-calculator link, « À propos » overview, discovery and official links. A fixed bottom estimate CTA (`StickyEstimateBar`) is used below `lg`; it stays hidden while the hero estimate button is on screen (IntersectionObserver on `HERO_ESTIMATE_CTA_ID`) and slides in once it has scrolled away. On phones the `PublicHeroShell` metric strip wraps into rows (3 + 2 for five metrics, 2 + 2 for four) instead of scrolling, so no label is cut at the screen edge; from `sm` it is a single scrollable row. `RaceMetricsDetails` is removed: its D−/altitude values live in the hero strip. On mobile the page relies on the RootChrome horizontal padding only.

The web Supporter Guide programme is grouped by calendar day from the server `timeline`, with localized dates/distances and cutoffs labelled with their weekday when they fall after the race day.

`/courses/supporter-guide/[raceId]` is the public, mobile-first Livret supporter route. It is intentionally `noindex`, uses the same publication cache tags as RaceBook output, and returns unavailable when no visible format has a current immutable publication. Its UUID selects the edition; the payload may include every public, preview-visible published format in that edition. An active organizer of the event also opens it for a private edition: the client retries with the stored session token and shows the organizer preview banner; anonymous visitors still get unavailable. A visit tagged `?src=plaquette` (the printed organizer brochure QR code, see `apps/web/lib/demo-app-link.ts`) is redirected to `/demo` before rendering, which opens the app on Android or the organizer landing page otherwise. A visit tagged `?src=carte` (the printed business card QR code) is redirected to `/carte-visite`, which opens the app on Android or sends the visitor to the Google Play / App Store listing (`/links` on desktop). Any other `src` value renders the guide normally.

The public course practical section may show `thirdPartyPickupConditions` only when the bib-pickup module is public and third-party pickup is allowed. This additive copy does not participate in catalog eligibility, search, canonical identity, slug resolution, ISR visibility, or structured-data selection.

## Purpose

This document defines which public race pages Pace Yourself may expose to search engines and how the catalog creates useful internal links without inventing missing race facts.

## Key Concepts

- Web-public race: a `races` row where both `web_catalog_is_live` and `is_public` are true, under a live optional parent event.
- Mobile-visible edition: a `race_event_editions` row whose `is_visible` flag permits attached formats to participate in mobile course/RaceBook discovery; it does not remove an already published web page.
- Event edition format: another public race attached to the same non-null `event_id + edition_id`; legacy rows without an edition fall back to `event_id`.
- Similar race: an upcoming or undated race from another event ordered by distance difference, then elevation difference when both elevations exist.
- Demo event: the fixed Trail TST event (`DEMO_EVENT_ID`, `isDemoRaceEventId` in `apps/web/lib/demo-race.ts`), the target of the printed brochure and business card QR codes.
- Indexable selection: a deterministic landing page based only on structured fields and containing at least five public races.
- Normalized geography: explicit country, region, department and city fields, not a region guessed from `location` or `location_text`.
- Former slug: a durable `race_slug_redirects.old_slug` mapping to the stable race id.
- App bridge: the public course page may promise the Livret coureur only when `racebook_is_live` is true and the attached edition is mobile-visible; otherwise it uses generic app preparation copy.
- `lib/app-store.ts` also exports `detectMobileAppPlatform`, used by the shared-plan app gate; course-page store resolution (`resolveAppStoreTarget`) is unchanged.
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

The page always exposes `BreadcrumbList` structured data and exposes `SportsEvent` only when the format has a valid calendar `startDate` in strict `YYYY-MM-DD` form. Its `Place` may use the verified start label, start coordinates, start-address string, and normalized parent city/region/country; unavailable postal components are omitted and a place name is never inserted into `PostalAddress`. `eventStatus` is `EventScheduled` only while the format (its `endDate` when emitted, otherwise its `startDate`) has not passed in Europe/Paris, because the current schema has no cancellation/postponement status. schema.org has no "finished" `EventStatusType`, so a past format keeps its factual `SportsEvent` (the edition page references its `@id`) but omits `eventStatus` and the registration `Offer`, which both describe an event still to come. The edition `SportsEvent` applies the same rule to its inclusive `end_date`. The organizer is the known event identity (falling back to the format identity) with its official HTTP(S) website when available. The registration action becomes an `Offer` containing only its URL; price, currency, and availability remain absent because the catalog does not store them.

`endDate` remains the same date for a single-day edition. A later canonical edition end is emitted only when unambiguous stored start and finish-cutoff clocks prove an overnight format by wrapping past midnight; prose or incomplete clocks cannot establish that fact. Formats attached to a slugged edition emit a `superEvent` reference to its canonical event page. Open Graph and Twitter use the format image first, the event image second, and the shared Pace Yourself social image last. SEO titles are capped at 60 characters, reserve a factual distance/year suffix, and truncate the middle of long names so both the event prefix and distinguishing format suffix survive; when the full name fits, a distance already present in the name is not repeated and a « · temps & ravitos » hook is appended if it still fits. A format name that does not contain its parent event name is prefixed as `Event — Format` in the title and description, so generic names (« 10 km ») stay unique across events. Event-edition titles keep `Event Year` within 60 characters by shortening the « formats, parcours et ravitos » suffix before truncating the name. Descriptions are capped at 160 characters and end with the reference time range (or a generic estimate invitation when no range can be computed). It links to:

- other published formats sharing the same event edition, with the legacy event-only fallback when `edition_id` is absent;
- up to three published, upcoming or undated races from other events with the nearest distance, using elevation only as a tie-breaker (a finished format and the Trail TST demo are never suggested);
- the planner at `/race-planner?catalogRaceId=<race-id>` (hero, reference-times block, desktop aside and mobile fixed bar) and the carbohydrate calculator;
- distinct format/event official sources and available official event social profiles.

Sharing uses the native Web Share sheet when available, which lets installed mobile apps such as Instagram participate. Facebook remains a direct action, copy is always explicit, and the main action falls back to copy when Web Share is unavailable. Native cancellation does not trigger a surprise copy. Missing Clipboard support falls back to the browser copy command and reports success/failure through an accessible live status.

## Catalog Event Grouping

Every public edition with at least one web-public format has one `/courses/evenements/<edition-slug>` page. Since 2026-11-22 its canonical is the permanent event hub (see below) whenever the event has a slug; the edition page stays reachable, keeps its own content and JSON-LD, and its breadcrumb goes through the hub. It lists only that edition's public formats (sorted by distance), their factual distance, D+, date and ravito count, and sanitized practical information inherited from the event. It emits one parent `SportsEvent` whose `subEvent` entries are `@id` references to the format pages. Former edition slugs permanently redirect after the current event and format visibility gates are rechecked. The sitemap lists the event hub instead of edition URLs (an edition URL only when its event has no hub slug) and uses the newest format timestamp available; station rows currently have no `updated_at`, so station-only changes cannot improve `<lastmod>` evidence.

After the inclusive `end_date` has passed in Europe/Paris, an edition page shows an “Édition terminée” banner; if the same event has a later edition with at least one web-public format, the banner links directly to it, otherwise to the hub (« Toutes les éditions »). An already-published later edition is also highlighted from a non-past page. A finished edition no longer shows the « S’inscrire » action (the official-site link stays in the overview).

## Permanent Event Hubs (2026-11-22)

Hub and edition pages share `EventEditionSections`, which also hands the edition funnel context to the hero analytics tracker (no visible change).

Every yearly edition used to be its own indexable URL (`hoka-utmb-mont-blanc-2026`, then `-2027`), so authority and queries split every year. Each event now has a durable year-free slug (`race_events.slug`, generated on insert, immutable, trailing edition year stripped) and a hub at `/courses/evenements/<event-slug>` in the same route as the edition pages. The database keeps event slugs disjoint from edition slugs and reserved edition redirects, so the route resolves the edition namespace first (current slug, then former slug with a 301), then the hub; nothing that resolved before changes.

- Indexation: the hub is the only indexable event page; every edition page (upcoming or past) canonicalizes to it but stays reachable with a 200, so inbound links, the Livret supporter follow page (`/<edition-slug>/suivre`) and printed links keep working. No edition URL is redirected: a 301 of past editions would remove the history the hub links to. Canonicalizing the upcoming edition too avoids two near-identical pages competing for the event query; its yearly facts are on the hub.
- Content: the featured edition is the earliest public edition whose inclusive `end_date` has not passed (Europe/Paris), otherwise the latest finished one (then a « Prochaine édition pas encore publiée » banner). The hub reuses the edition sections (`EventEditionSections`: hero, Livret supporter entry, formats linking to their pages, common information, app bridge, overview), adds « Livret coureur disponible » when a featured format has `racebook_is_live` on a mobile-visible edition (same rule as the course app bridge), and lists every edition with a web-public format, newest first, linking to each edition page.
- Titles: `buildEventHubMetadataTitle` uses the event name without a trailing year and appends the featured year only while that edition is upcoming; the description (≤ 160) gives the next (or last) edition date, format count and distance range.
- Structured data: the hub publishes the featured edition's `SportsEvent` under the edition `@id` (the one the format pages' `superEvent` references) with the hub as `url`/`mainEntityOfPage`, plus a `BreadcrumbList`. No `EventSeries`: it is an Event subtype that Google validates for `startDate`/`location` like the partial nested Events removed on 2026-11-16. Past featured editions keep the no-`eventStatus`/no-`Offer` rule.
- Links: the course page breadcrumb, a « Toutes les éditions et formats de … » link, and the catalog/landing cards « Voir l’événement » point to the hub. Format URLs keep their yearly slugs (follow-up: a year-free format pattern would need a format-series identity and is not attempted).
- Resilience: event slugs are read by a separate lenient query; if the column is missing (web deployed before the migration) hub links fall back to edition URLs and edition pages stay self-canonical.
- The Trail TST demo hub is reachable, `noindex,follow`, without `SportsEvent`, and absent from the sitemap.

Each event-edition header exposes one registration action (« S’inscrire sur le site officiel ») sourced from the shared event website, after the primary « Estimer mon temps » jump to the format list. Distance-selection cards use the same target, while standalone cards fall back to the format URL and retain a separate internal course-detail link.

The `/courses` catalog groups published formats by stable non-null `event_id + edition_id`. Historical rows with an event but no edition fall back to `event_id`; a display name is never an identity and two homonymous events remain separate. Each standalone race with no event id stays in its own card. Formats are ordered by numeric distance with unknown values last.

The default temporal filter contains upcoming/current formats followed by undated formats. Past formats are available separately and sorted newest first; the `Toutes` view keeps upcoming, undated, then past. Search is accent- and punctuation-insensitive, matches every entered token regardless of order, and covers format/event names plus every allowlisted format and normalized parent-event locality. It combines with distance and temporal filters through a server GET form. Visible result counters and a reset action describe the active state.

Filtering happens before grouping, so an event-edition card disappears when none of its formats matches. Every visible format remains a normal HTML link to `/courses/[slug]`, including formats collapsed behind the card's « autres formats » disclosure. Event-edition cards use the shared event image and year/date where available; standalone formats use their own image. A format image remains the first detail-page image choice. Missing images reserve no empty visual area. The responsive card layout stacks at narrow widths, keeps controls at least 44 px high and avoids horizontal tables.

The catalog paginates on the server at 12 event-edition groups per response and emits an `ItemList` only for the visible page, with positions continuing across pages. The full public race collection is never serialized into a client component. Unfiltered numbered pages have self-canonicals and crawlable previous/next links; out-of-range pages return not found. Search, distance, and period query combinations are `noindex,follow` and canonicalize to `/courses`, preventing a filter-index explosion while preserving discovery links.

## Trail TST Demo And Catalogue Data Quality (2026-11-22)

The Trail TST demo stays publicly reachable because the printed QR codes lead to it, but it is not a real race. Its format and edition pages show a « Course de démonstration » pill (`DemoRaceBadge`) in the hero, have no « S’inscrire sur le site officiel » action, no official-links block and no `SportsEvent` JSON-LD (its websites are placeholders), are `noindex,follow`, and the sitemap leaves out its formats, editions and their effect on distance-page dates. It is identified only by the fixed event id; there is no schema flag. Its current edition is moved to today every day by the demo refresh job, edition year included (see [Infrastructure](../01-architecture/infrastructure.md#demo-race-refresh)); the 2025 demo edition keeps its past dates.

Demo GPX realism (2026-11-23): the original seed GPX files were 13-point tracks that measured about 24 km for the 42 km demo race, so the planner preview contradicted the catalog row (an estimate for 42,6 km, then a plan of 23,8 km / 4h20). `scripts/demo-gpx/generate-trail-tst-gpx.mjs` regenerates `supabase/demo-assets/trail-tst-{18,42,82}.gpx` as dense closed loops (one point every 50 m) starting and finishing at Samoëns, scaled so the haversine length equals the catalog distance (18,4 / 42,6 / 82,3 km), with an altitude profile that passes through every seeded aid-station altitude and sums to the catalog D+ (860 / 2450 / 5120 m). `node scripts/demo-gpx/generate-trail-tst-gpx.mjs` rewrites the three files and prints their stats; keep its constants in sync with the seed migration `20260827093348_seed_trail_tst_demo_event.sql`. The repository files are only the source: production reads the objects under `race-gpx/trail-tst/2026/` and the organizer copies made by the demo refresh. `scripts/demo-gpx/upload-trail-tst-gpx.mjs` replaces them (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` required, `--backup-dir <dir>` required, `--dry-run` available): it selects the `races` rows whose `gpx_sha256` is still one of the old 13-point files, downloads each current object into the backup directory, uploads the new file (`x-upsert`), then updates `races.gpx_sha256` and `gpx_hash`.

The upload ran in production on 2026-11-23 with the maintainer's go: six `races` rows were updated (the three 2025 seed formats under `race-gpx/trail-tst/2026/` and the three organizer copies of the current demo edition), and `GET /api/race-catalog/[id]/gpx` now serves the dense tracks (853 points for the 42 km). Because the script matches on the old hashes only, running it again is a no-op. To restore the previous files, upload the backed-up objects to the same paths and set `gpx_sha256` / `gpx_hash` back to the old values listed in the script.

Course detail display rules:

- D− in the hero: catalogue imports store `elevation_loss_m = 0` when the source gives no descent (649 of 826 web-public formats on 2026-11-22, only 5 of them with a GPX). A stored 0 is therefore hidden unless the GPX preview confirms it; the GPX descent replaces a missing or 0 value (`getDisplayedElevationLossM`). A positive stored value always wins.
- Distances in the meta description and the overview use the French decimal comma (« 158,68 km »), like the title and the hero.
- Aid-station timeline: an organizer row that already is the start (named Départ, or at km ≤ 0.1) or the finish (named Arrivée, or within 0.1 km of the format distance) is merged into that endpoint with its services instead of being listed twice (`buildAidStationTimelineEntries`).
- « Autres formats » chips show the format label within the event plus the distance unless the label already carries it (`getSiblingFormatLabel`), so formats of equal length (solo / relais / marche) stay distinguishable.

## Prefiltered Landing Pages

Landing pages share one contract (`lib/race-landing-pages.ts`, `RaceLandingPage`): they list only dated upcoming formats (today included, Europe/Paris; never the Trail TST demo), exist and are indexable only with at least five such formats (`MIN_INDEXABLE_RACES`), group formats into the `/courses` event cards, paginate 12 groups per page (`/page/<n>`, self-canonical, `prev`/`next`; `/page/1` and out-of-range pages are not found), emit a page-scoped `ItemList` and a breadcrumb, keep titles ≤ 60 and descriptions ≤ 160 characters (page number included), and link to every other indexable distance, region and month page. `/courses` shows the same selections. Regions are `/courses/regions/<slug>` for the 18 French INSEE regions; months are `/courses/mois/<mois>-<année>` (`mai-2027`), so a month page disappears (404) once its formats have passed.

Distance pages use three mutually exclusive structured ranges:

- `trail-court`: less than 30 km;
- `trail-30-79-km`: at least 30 km and less than 80 km;
- `ultra-trail`: at least 80 km.

A page is generated and indexable only while at least five upcoming public races have a numeric distance in its range. Below that threshold it is omitted from navigation and the sitemap, and the route returns not found.

## Geographic Landing-Page Guardrail

`race_events` now has explicit normalized city, department, region and country names/codes plus an anchor-city coordinate pair. All current live events have a verified country; after the March–May 2027 organizer-source batch, 46 French events have complete commune, department, region and coordinate enrichment. The 50 remaining official UTMB international events intentionally stay country-only until one unambiguous locality is verified.

The 2027 extension publishes 15 organizer-verified formats across the Trail du Petit Ballon, Grand Trail des Cadourques, and Volvic Volcanic Experience. It reuses the existing Volvic event, corrects its parent anchor while preserving the 2026 XGTV route label, creates canonical visible 2027 editions, and keeps unpublished D+ values null.

Regional landing pages are enabled for French regions (2026-11-22). A format belongs to a region only through its live parent event's `location_country_code = 'FR'` and `location_region_code` (INSEE); migration `20261122230000` backfilled the code from the exact normalized `location_region` name for the 87 French events that had the name but no code. The derived `PublicRace.regionSlug` is the only region value added to the catalog DTO. Departmental and city pages are still not enabled; they must follow the same rules. Free-text `location`/`location_text`, postal-code guesses and runtime city-to-region lookup remain unacceptable sources of truth.

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
- Do not suggest a finished format as a similar race, and never suggest, index or list the Trail TST demo in the sitemap; keep it reachable for the printed QR codes.
- Do not show a D− of 0 that only comes from an import placeholder; trust a 0 only when the GPX gives it.
- Do not emit `EventScheduled` or a registration `Offer` for a finished format or edition.
- Do not group catalog rows by `eventName`, course name, or location; only stable `eventId + editionId`, with the documented legacy `eventId` fallback, may merge formats.
- Do not serialize raw organizer JSON, emergency phone data, `lastMinuteMessage`, GPX Storage paths, or full GPX content into public client components.
- Similarity is a navigation aid, not a statement that courses have comparable terrain or difficulty.
- Do not expose a thin landing page merely because its URL pattern exists; the five-race threshold is part of the indexation contract.
- Do not derive regions or departments from display-location strings; exclude null normalized values from exact geographic filters.
- Do not link or list a landing page without checking its five-format threshold (`getIndexable*Pages`): the route returns 404 below it.
- Do not give an event slug to an edition or the other way round: the triggers reject it, and the route would serve the edition first.
- Do not change `race_events.slug`: it is immutable (no event-slug redirect table yet). Renaming an event changes neither slug.
- Do not publish thin region/city SEO pages merely because a normalized field exists. Geographic indexation still requires the five-race threshold and useful unique content.
- Keep all public queries restricted to explicit columns and published rows.
- Never reuse a former slug for another race. It remains reserved in `race_slug_redirects` while the target race exists.
- Do not run a slug migration from the dry-run script; it deliberately has no write path.

## Related Docs

- [Web App](../01-architecture/web-app.md)
- [race_events](../02-database/tables/race-events.md)
- [race_slug_redirects](../02-database/tables/race-slug-redirects.md)
- [Organizer Race Management](organizer-race-management.md)

## Livret supporter follow pages (2026-11-16)

`/courses/evenements/[slug]/suivre` is an indexable, server-rendered summary of the public Livret supporter of an edition: programme by day, supporter points and aid stations open to supporters (allowed or restricted) per format, deduplicated access, parking and shuttle rows, and links to the full client guide (`/courses/supporter-guide/[raceId]`, still `noindex`). It reads the public `/api/supporter-guide` endpoint (never organizer preview) through `getPublicSupporterGuide`, with an ISR-compatible fetch cache of 15 minutes and the RaceBook edition cache tag, trying up to three formats because the endpoint answers 404 for a non-public format (calling the `no-store` service loader inside a statically regenerated page made Next.js abort with DYNAMIC_SERVER_USAGE and return 404 in production); when no format is live with an effective `supporter_guide` module the route returns 404 and is never indexed. The event page shows a « Suivre la course » link only for upcoming editions with such a guide. Follow pages are not listed in the sitemap (discovery is through the event page link) to avoid loading every guide at sitemap build.

`sitemap.ts` also lists `/survol` (2026-11-22), the organizer flyover video order page ([Organizer Flyover Video Orders](flyover-video-orders.md)); its order pages `/survol/commande/<id>` are noindex and not listed.

`/livret-coureur` and `/livret-supporter` are static, indexable product pages for runners and for supporters (family, friends, public), listed in the sitemap and the footer; they describe only existing surfaces and route organizers to `/organisateurs`.

The `/livret-coureur` product page mentions the organizer entry price (« dès 199 € HT par édition », since 2026-11-22); it stays a static copy aligned with `ORGANIZER_TIER_PRICE_EUR`.

## Funnel analytics (2026-11-22)

The hero shell mounts `RaceFunnelTracker`, which emits `race page viewed` and `race estimate cta clicked` (the hero, sticky bar and estimates-section links carry `data-estimate-placement`). Navigation, links, SEO output and the estimate flow are unchanged. Web runner funnel analytics (2026-11-22): see [analytics.md](../05-integrations/analytics.md#web-runner-funnel-2026-11-22).

## Internal links for crawl discovery (2026-11-23)

A 2026-11-23 URL Inspection pass found 392 of 830 format URLs never crawled and most blog articles unknown to Google. To shorten crawl paths, format pages link to distance-matched blog guides (« Pour préparer cette course »), and the home page and every blog article link to the indexable distance, region and month landing pages. These links follow the landing-page eligibility rules (upcoming formats, `MIN_INDEXABLE_RACES`), so they never point to a 404 selection. No route, canonical or structured-data change.

## Course weather touch (2026-11-23)

The public race page mounts `CourseRaceDayWeather` (client component, fetched from `GET /api/race-weather`, so the ISR page output is unchanged) before « Informations pratiques ». It shows nothing for past races or when the forecast is unavailable. No data model change. See [Design Components](../07-design-system/components.md) "Course weather".
