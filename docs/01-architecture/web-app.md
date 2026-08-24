---
title: Web App Architecture
scope: architecture
last_verified: 2026-08-24
ai_priority: high
related_files:
  - apps/web/package.json
  - apps/web/app/layout.tsx
  - apps/web/next.config.mjs
  - apps/web/app/admin/components/AdminRaceCatalogSection.tsx
  - apps/web/app/hooks/useVerifiedSession.tsx
  - apps/web/app/hooks/useOrganizerMembershipStatus.ts
  - apps/web/app/header-tabs.tsx
  - apps/web/app/header-menu.tsx
  - apps/web/components/SiteFooter.tsx
  - apps/web/app/robots.ts
  - apps/web/app/sitemap.ts
  - apps/web/app/noindex-metadata.ts
  - apps/web/app/courses/page.tsx
  - apps/web/app/courses/[slug]/page.tsx
  - apps/web/app/courses/_components/RaceCatalogFilter.tsx
  - apps/web/app/courses/_components/PublicRaceLinks.tsx
  - apps/web/app/courses/distances/[category]/page.tsx
  - apps/web/app/courses/race-discovery.test.ts
  - apps/web/app/calculateur-glucides-trail/page.tsx
  - apps/web/app/calculateur-glucides-trail/CarbCalculator.tsx
  - apps/web/app/calculateur-glucides-trail/carb-calculator-fun.test.ts
  - apps/web/app/a-propos/page.tsx
  - apps/web/app/methodologie/page.tsx
  - apps/web/lib/public-races.ts
  - apps/web/lib/race-discovery.ts
  - apps/web/lib/carb-calculator.ts
  - apps/web/lib/carb-calculator-fun.ts
  - apps/web/app/api/auth/session/route.ts
  - apps/web/app/api/resend/contact/route.ts
  - apps/web/app/api/plans/route.ts
  - apps/web/app/api/plans/from-catalog/route.ts
  - apps/web/lib/organizer-aid-station-products.ts
  - apps/web/app/api/plan-shares/route.ts
  - apps/web/app/api/plan-shares/crew-state/route.ts
  - apps/web/app/share/plan/[token]/page.tsx
  - apps/web/app/share/plan/[token]/PlanShareCrewTimeline.tsx
  - apps/web/app/root-chrome.tsx
  - apps/web/lib/plan-share.ts
  - apps/web/app/api/race-catalog/route.ts
  - apps/web/app/api/admin/race-catalog/utmb/route.ts
  - apps/web/app/api/admin/race-catalog/tracedetrail/route.ts
  - apps/web/app/api/admin/race-catalog/tracedetrail/route.test.ts
  - apps/web/app/api/admin/race-catalog/tracedetrail/importer.test.ts
  - apps/web/lib/tracedetrail-race-import.ts
  - apps/web/lib/organizer.ts
  - apps/web/app/organizers/page.tsx
  - apps/web/app/organizer/page.tsx
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/dashboard/types.ts
  - apps/web/app/organizer/_components/dashboard/constants.ts
  - apps/web/app/organizer/_components/dashboard/helpers.ts
  - apps/web/app/organizer/_components/dashboard/helpers.test.ts
  - apps/web/app/organizer/_components/dashboard/utf8-copy.test.ts
  - apps/web/app/organizer/_components/dashboard/controls.tsx
  - apps/web/app/organizer/_components/dashboard/address-autocomplete-field.tsx
  - apps/web/app/organizer/_components/dashboard/shell.tsx
  - apps/web/app/organizer/_components/dashboard/event-format-editors.tsx
  - apps/web/components/gpx/GpxRouteMap.tsx
  - apps/web/components/gpx/GpxRouteMapClient.tsx
  - apps/web/app/organizer/_components/dashboard/detail-editors.tsx
  - apps/web/app/organizer/_components/dashboard/aid-stations-editor.tsx
  - apps/web/app/organizer/_components/dashboard/products-editor.tsx
  - apps/web/app/organizer/_components/completion.ts
  - apps/web/app/organizer/_components/completion.test.ts
  - apps/web/lib/organizer-dashboard-details.ts
  - apps/web/lib/organizer-dashboard-details.test.ts
  - apps/web/lib/organizer-document-import.ts
  - apps/web/lib/organizer-import-engine.ts
  - apps/web/lib/organizer-import-engine.test.ts
  - apps/web/lib/organizer-import-reconciliation.ts
  - apps/web/lib/organizer-source-intelligence.ts
  - apps/web/lib/organizer-source-intelligence.test.ts
  - apps/web/lib/organizer-import-proposals.ts
  - apps/web/app/organizer/_components/dashboard/website-import-review-details.tsx
  - apps/web/app/organizer/_components/dashboard/website-import-review-details.test.ts
  - apps/web/app/api/organizer/events/[id]/website-import/reconciliation.test.ts
  - apps/web/vitest.config.ts
  - apps/web/app/admin/_components/AdminOrganizerClaimsTab.tsx
  - apps/web/app/api/organizer/claims/route.ts
  - apps/web/app/api/organizer/claims/route.test.ts
  - apps/web/app/api/organizer/edition-requests/route.ts
  - apps/web/app/api/organizer/edition-requests/route.test.ts
  - apps/web/app/api/organizer/publication-requests/route.ts
  - apps/web/app/api/organizer/publication-requests/route.test.ts
  - apps/web/app/api/organizer/publication-requests/readiness.test.ts
  - apps/web/app/api/organizer/events/route.ts
  - apps/web/app/api/organizer/events/route.test.ts
  - apps/web/app/api/admin/organizer-claims/route.ts
  - apps/web/app/api/admin/event-publication-requests/route.ts
  - apps/web/app/api/admin/event-publication-requests/route.test.ts
  - apps/web/app/api/organizer/events/[id]/route.ts
  - apps/web/app/api/organizer/events/[id]/route.test.ts
  - apps/web/app/api/organizer/events/[id]/website-import/route.ts
  - apps/web/app/api/organizer/events/[id]/website-import/route.test.ts
  - apps/web/app/api/organizer/events/[id]/website-import/parser.test.ts
  - apps/web/app/api/organizer/events/[id]/updates/route.ts
  - apps/web/app/api/organizer/events/[id]/updates/route.test.ts
  - apps/web/app/api/organizer/events/[id]/image/route.ts
  - apps/web/app/api/organizer/events/[id]/image/route.test.ts
  - apps/web/app/api/race-favorites/route.ts
  - apps/web/app/api/race-favorites/route.test.ts
  - apps/web/app/api/race-events/[id]/updates/route.ts
  - apps/web/app/api/race-events/[id]/updates/route.test.ts
  - apps/web/app/api/organizer/races/route.ts
  - apps/web/app/api/organizer/races/route.test.ts
  - apps/web/app/api/organizer/races/[id]/route.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.test.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.test.ts
  - apps/web/app/api/organizer/races/[id]/relay-points/route.ts
  - apps/web/app/api/organizer/races/[id]/relay-points/route.test.ts
  - apps/web/app/api/organizer/races/[id]/aid-station-products/route.ts
  - apps/web/app/api/location-search/route.ts
  - apps/web/lib/organizer-website-import.ts
  - apps/web/lib/organizer-publication.ts
  - apps/web/app/api/plans/from-catalog/route.test.ts
  - apps/web/app/api/stripe/checkout/route.ts
  - apps/web/lib/location-utils.ts
  - apps/web/lib/push.ts
related_tables:
  - race_plans
  - plan_share_links
  - races
  - race_aid_stations
  - race_relay_points
  - race_event_claims
  - race_event_organizers
  - race_event_publication_requests
  - race_event_updates
  - race_event_update_reads
  - race_aid_station_products
  - user_favorite_race_events
  - user_profiles
  - subscriptions
  - push_devices
  - push_notification_events
---

# Web App Architecture

## Purpose

The web app owns the browser planner, onboarding/account flows, admin catalog tools, server-side API routes, and most Supabase service-role operations. Read this before changing `apps/web` routes or planner state.

## Key Concepts

- App Router: Next.js app routes live under `apps/web/app`.
- Server API route: a Next.js route handler that wraps Supabase, Stripe, RevenueCat, or storage calls.
- Verified session: browser session state verified against Supabase by `/api/auth/session`.
- Service role: server-only Supabase key used for privileged database and storage operations.
- Planner values: JSON payload saved in `race_plans.planner_values`.

## Framework Setup

`apps/web/package.json` marks the package as ESM with `"type": "module"`. Main scripts are:

- `npm run dev --workspace apps/web`
- `npm run build --workspace apps/web`
- `npm run start --workspace apps/web`
- `npm run lint --workspace apps/web`
- `npm run test --workspace apps/web`
- `npm run typecheck --workspace apps/web`

The current web stack still runs on `react` / `react-dom` `18.3.1`. Any browser map bindings added under `apps/web` must stay compatible with React 18 until the app is upgraded; for Leaflet route previews that means staying on the React 18-compatible `react-leaflet` line rather than the React 19-only v5 releases.

`apps/web/next.config.mjs` enables:

- optional MDX page support when MDX dependencies are available;
- `experimental.typedRoutes = true`;
- `eslint.ignoreDuringBuilds = true`;
- transpilation of `@trailplanner/shared` and `@pace-yourself/design-system`;
- custom SVG handling through SVGR for component imports.

## Main Runtime Areas

### Organizer Information Import

The organizer dashboard action is named `Importer les informations` and is visible and callable only to a trusted admin. Its source step accepts an optional main website URL, up to twelve additional official URLs of any useful role, and up to eight PDF/image selections capped at 25 MB each. Additional URLs may be event, regulation, program, logistics, registration, archive, or format pages; their presence never asserts that each URL is one format. The browser uploads documents directly to the private `organizer-imports` Storage bucket, then sends only their temporary paths to the API. The session manifest retains those paths only for the two review passes; apply, cancel, or expiry cleanup deletes the objects. A document-only discovery remains possible without a website URL.

The workflow has two reviews. Format discovery comes first and reports existence confidence independently from field completeness. It does not merge anonymous or named candidates from distance alone, and it keeps incomplete candidates available for confirmation. The admin confirms the final format count, bindings, names, additions, and ignores before field enrichment begins.

Enrichment converts website, structured data, GPX, current Organizer data, previous-edition references, and paginated PDF findings into typed source claims. PDF findings keep a match-centered excerpt capped at 2,000 characters for evidence and 500 for the typed value; equivalent document claims are deduplicated and limited to eight per scope and field for each document. The review displays current value, alternatives, source URL or document/page, evidence, confidence, conflicts, and missing fields for every confirmed format. New formats may stay incomplete hidden drafts. OCR for images and scanned PDFs remains pending.

For generic pages and extracted text PDFs, a bounded deterministic pass first classifies each source and extracts explicit assertions. OpenAI is then used only for ambiguous or incomplete sources, with strict grounded output: values, evidence, and named formats must occur in the source. Registration/results/unusable pages are reported but cannot manufacture formats or course claims. The source pass is capped at twelve sources and 48,000 total characters, cached for 30 minutes by content/model hash, and persisted as signed claims for the second pass. Separately, field conflict reconciliation can return only an existing applicable `claimId` or `uncertain`; it cannot return a value or select a previous-edition reference claim. Distance concordance uses `max(0.5 km, 2%)`, and D+/D- use `max(100 m, 8%)`. Only a high-confidence, conflict-free fill of an empty field may be preselected.

### Authentication and Session

The client session entry point is `apps/web/app/hooks/useVerifiedSession.tsx`. It:

- reads and writes tokens through `apps/web/lib/auth-storage.ts`;
- verifies access tokens by calling `apps/web/app/api/auth/session/route.ts`;
- passes refresh tokens through the `x-refresh-token` header when needed;
- fetches entitlements through `apps/web/lib/entitlements.ts`;
- triggers the authenticated Resend contact sync for identified, non-anonymous sessions;
- clears planner local storage on sign-out.

The session API route validates Supabase users through `apps/web/lib/supabase.ts`, calls `ensureTrialStatus`, and sets HTTP-only cookies through auth cookie helpers.

### Planner API

Saved plans are handled by `apps/web/app/api/plans/route.ts`. The route:

- verifies a bearer token with Supabase anon config;
- reads and writes `race_plans`;
- stores planner state in `planner_values`;
- stores elevation in `elevation_profile`;
- checks entitlements before creating extra plans;
- enriches aid stations with nutrition when `fuelTypes` are present;
- overlays current organizer ravito products from `race_aid_station_products` on GET for plans linked to a `race_id`, without mutating the stored `planner_values`.

Catalog race plan creation is handled by `apps/web/app/api/plans/from-catalog/route.ts`. It copies GPX from `race-gpx` into `plan-gpx`, parses elevation, creates `plan_aid_stations`, and copies source station `waterRefill`, `solidRefill`, and `assistanceAllowed` flags into `planner_values.aidStations`.

When the source race has organizer station products, the route loads them server-side and stores `planner_values.organizerAidStationProducts` as an import-time fallback snapshot. The same mapping is reused by `/api/plans` GET so saved plans linked to a race receive the current official ravito products at read time. Suggestions are keyed by source station id when available, with a legacy `name|km` fallback, displayed in the planner, shown in the manual product picker for the matching ravito, and kept out of auto-fill by default unless the runner favorites/selects the product or enables the ravito-products auto-fill option.

Plan crew recap links are handled by `apps/web/app/api/plan-shares/route.ts`, `apps/web/app/api/plan-shares/crew-state/route.ts`, `apps/web/app/share/plan/[token]/page.tsx`, and `apps/web/app/share/plan/[token]/PlanShareCrewTimeline.tsx`. The mobile app sends an authenticated snapshot generated from the saved plan recap. The API verifies the bearer token, checks `race_plans.user_id`, creates a stable server-derived public token for new reusable links, stores only its SHA-256 hash in `plan_share_links`, and returns the public URL. Re-sharing a plan updates the existing stable link snapshot instead of creating another URL; legacy random-token links remain readable but cannot be re-shown because the raw token was never stored. Share URLs use the canonical web domain from `PLAN_SHARE_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, or `APP_URL`, falling back to `https://pace-yourself.com`; `.vercel.app` hostnames are ignored even when they come from those env vars. The public page hashes the URL token server-side and renders the stored snapshot plus limited `crew_state`, with highlighted assistance checkpoints, muted no-assistance checkpoints, and crew controls that persist the corrected start time and confirmed assistance passages. The crew can clear confirmed passages from the tracking card to return calculations to the planned snapshot times without changing the runner's shared snapshot.

### Race Catalog and GPX

Admin catalog creation lives in `apps/web/app/api/race-catalog/route.ts`. It requires an admin user, validates GPX, can create a `race_events` row, uploads GPX to the private `race-gpx` bucket, uploads images to `race-images`, and inserts `races` plus `race_aid_stations`. New event/race rows from this flow should start as draft (`is_live = false`) unless the admin explicitly marks them live.

The Trace de Trail admin dialog uses `/api/admin/race-catalog/tracedetrail` for preview, import, and direct GPX download. The adapter tries authenticated then public provider downloads and may rebuild a GPX from geometry already embedded in the accessible trace page. Direct download returns the GPX without database or Storage writes. Catalog creation initializes the required edition-series fields for the first imported edition.

User-created private races live in `apps/web/app/api/races/route.ts`. They are inserted with `is_public: false` and `created_by` set to the authenticated user.

### Public SEO Routes

The public race discovery surface lives at `/courses`. It loads only rows where both `races.is_live` and `races.is_public` are true through the Supabase anon key, using explicit public column selects. The catalog is rendered server-side and offers client-side name/location and distance filters. These filters do not create crawlable URL combinations.

Each live public race has a canonical `/courses/[slug]` page. Known slugs are returned from `generateStaticParams`; both the catalog and detail pages revalidate hourly, and uncached slugs remain resolvable at runtime. Detail pages expose only published race/event facts, add `SportsEvent` and `BreadcrumbList` JSON-LD, and link to the planner, calculator, official source, other formats of the same event, and up to three similar races when available.

`/courses/distances/[category]` provides crawlable discovery pages for short trails, 30–79 km trails, and ultra-trails. A category is generated, linked, and included in the sitemap only when at least five published races have a structured distance in its mutually exclusive range. Region pages remain disabled until the public race contract exposes normalized region or department data; free-text locations are not used to manufacture geographic landing pages.

`/calculateur-glucides-trail` is a public server-rendered landing page with an interactive client calculator. Duration, distance, elevation gain, and digestive-tolerance sliders keep their visible values, but the nutrition result remains hidden until the runner starts an explicit calculation. A short client-only loading state reveals the estimate and one intentionally unfair elite pace comparison. The comparison is deliberately compact: one projected time-gap headline followed by one larger randomized trail mishap. Changing any slider invalidates the displayed result. Distance and elevation provide comparison context only; they do not alter the carbohydrate estimate.

The calculator's bounded duration/tolerance interpolation lives in `apps/web/lib/carb-calculator.ts` and is documented separately from the full planner allocation rule. Its share links are stateless: `duration`, `tolerance`, `distance`, `elevation`, and stable `comparison` / `joke` ids reproduce the same estimate and copy. The client accepts only in-range, step-aligned values and known ids; invalid or incomplete query strings fall back to the untouched calculator. Sharing uses the browser Web Share API when available and clipboard copy otherwise, without a database write.

`/a-propos` and `/methodologie` explain the product mission, editorial safeguards, calculator assumptions, source policy, and correction path. They are linked from the global footer and included in the sitemap to provide public trust and provenance signals.

`sitemap.ts` includes the race catalog, every currently published race slug, qualified distance pages, the calculator, trust pages, and existing blog pages. `robots.ts` permits public crawling but excludes `/api/`. Account, admin, onboarding, organizer-dashboard, and token-share route layouts reuse `noindex-metadata.ts`; they remain crawlable so search engines can observe the noindex directive, but should not remain in the index.

### Organizer Portal

The organizer header also exposes `Importer les informations`. That flow posts to `/api/organizer/events/[id]/website-import`, reuses the existing UTMB / Trace de Trail import adapters when possible, and falls back to generic HTML/JSON-LD extraction. It is review-first in two passes: source discovery writes no race data; confirming the final format list atomically binds existing rows or creates hidden drafts; applying reviewed fields later enriches only that event and those confirmed formats. It must never create another event row or publish a Racebook automatically. Historical drafts are importable even after the normal edition edit window has elapsed.

The post-analysis recap uses a viewport-bounded flex dialog: its header and validation actions stay fixed while the center review panel owns vertical scrolling. The flex display is explicitly prioritized because the shared `cn` helper concatenates utility classes and does not resolve a route-level `flex` against the dialog primitive's default `grid` class.

Each detected format carries existence evidence plus a separate completeness summary. Scores may help order the review but are not a visibility or creation threshold. The first step exposes all credible candidates so the admin can confirm the count, merge/split detections, bind an existing format, add a missing format, or ignore a false positive. A candidate remains confirmable without date, distance, D+, or GPX.

For non-provider sites, the general URL remains the primary source for event-level facts and common logistics and can also yield structured format blocks. The importer discovers a bounded set of hint-matched same-origin pages and combines them with the explicitly supplied additional official URLs. Every fetched page is classified by role before its grounded assertions are promoted. Only compatible event/format/regulation evidence with an explicit name can add a format candidate; registration deadlines, result archives, unrelated logistics, and unnamed distances cannot. Extraction otherwise combines JSON-LD, accessible tabs, embedded GeoJSON, headings, named regulation prose, and bounded LLM assistance. Candidate consolidation requires compatible normalized identity evidence. Anonymous same-distance detections remain separate for the admin, and proximity alone never attaches a GPX to a named candidate across pages. The legacy one-pass `formatUrls` request remains readable as its former authoritative compatibility mode, but the current two-pass UI writes `additionalUrls`.

GPX detection accepts explicit `.gpx` URLs, labeled download anchors, supported Trace de Trail embeds, and complete public GeoJSON route geometry. Recovered geometry is parsed through the normal GPX pipeline and becomes a high-confidence claim only after unambiguous format association. The importer never guesses absent elevation data or reconstructs routes from map tiles/screenshots. Incomplete confirmed formats may still be created as hidden drafts; a format without GPX keeps `gpx_storage_path = null` and uses only the existing deterministic legacy placeholder where the database constraint requires it.

The v1 organizer portal is web-only:

- For a trusted admin, `/api/organizer/claims` replaces the membership-limited selector data with every `race_events` row ordered by name, including drafts. The downstream Organizer detail and mutation routes use the same admin bypass through `requireEventOrganizer`; non-admin selector data remains membership-scoped.

- `/organizers` creates a new catalog-visible event through `POST /api/organizer/events` and immediately creates its active owner membership; its Racebooks remain hidden. It does not claim existing catalog events. With an official URL, the page redirects to `/organizer` with the new event selected and automatically opens its website-import analysis. The `/organizer` server page normalizes `eventId` and `importUrl` from its `searchParams` prop before passing them to the client dashboard, which keeps the route compatible with static generation without a client-side search-param bailout.
- `/organizer` lets active event members maintain catalog-visible events, canonical `race_event_editions` ranges, and attached formats. Its compact edition header keeps the year selector beside a `Créer une nouvelle édition` button. The compatibility `/api/organizer/edition-requests` URL creates the edition either empty or with cloned formats and no longer writes the retired review table. Catalog liveness stays read-only. Each format's Racebook switch sends its own `raceId` for admin review before approval, then controls only that row's `racebook_is_live` afterward. Using one switch waits only for unsaved changes on that same format; an incomplete draft in another tab or a different current edition does not block the selected format's publication.
- In a selected format tab, the required module card is named `Course`. The `Formats & GPX` editor stays permanently expanded, has no internal runner-preview or single-format duplication action, and aligns the destructive format-delete action at the far right of its title row. Its former helper description is intentionally omitted. Format dates and locations inherit respectively from the selected edition and event until the organizer enables their explicit `Date différente` or `Lieu différent` controls.
- The format information grid exposes one `Nom du format` input. Its client state and save payload keep `races.name` and `races.series_name` identical, while `edition_group_id` remains the stable cross-year grouping key.
- The organizer dashboard now uses a route-local address autocomplete field for event location, format location, bib pickup, and start/finish access addresses. Bib pickup accepts several event-level locations, each with several structured date/start/end slots; the legacy single location and free-text schedule remain readable as compatibility fallbacks. The editor calls `/api/location-search`, keeps the first bib location mirrored into the legacy text/location fields, and stores the complete location and slot list in `organizer_details` so published runner surfaces can expose every address, GPS link, day, and time range.
- The event `Informations` editor stores the optional official website plus a structured emergency contact name and phone in `race_events.organizer_details`. French phone inputs are normalized to the canonical `+33 X XX XX XX XX` display by the event details parser. These values stay behind the existing organizer membership-checked event route; no separate event column or client-side Supabase write is introduced.
- The organizer creation screen and dashboard keep concise, consistently accented French copy across `/organizers` and `/organizer`.
- The main header always shows "Mes courses" / "My races". It opens `/organizers` to let a new organizer create their first event, then opens `/organizer` after `/api/organizer/claims` reports at least one active membership.
- `apps/web/lib/organizer.ts` centralizes bearer-token verification, admin checks, service headers, and event-membership checks.
- `/api/organizer/*` routes verify the current Supabase user and then use the service role for authorized mutations.
- `/api/race-favorites` is the authenticated runner bridge for favoriting `race_events`, and `/api/race-events/[id]/updates` is the runner/mobile read route for the latest published organizer announcements on live events.
- `/api/admin/organizer-claims` keeps legacy access-claim review and membership revocation, and lets a trusted admin attach an existing Supabase Auth e-mail to an event as an `organizer`. Auth-user lookup and membership writes stay server-side; direct assignment grants edit access without changing catalog/Racebook state. `/api/admin/event-publication-requests` returns the pending queue plus every event's current-edition Racebook state. Approval invokes the service-role-only review function; the admin event switch invokes a separate service-role-only function to publish or hide Racebooks.

Organizer edits are source edits for `race_events`, `race_event_editions`, `races`, `race_aid_stations`, `race_relay_points`, and station products. The selected edition owns the canonical start/end range; format rows attach through `edition_id`. Relay replacement uses its own service route after ravitos are saved so optional station links are stable. Organizer-managed course rows remain catalog-visible. All writes stay behind active event membership checks; first Racebook publication validates the current edition, and later approved organizer toggles affect only the selected format's `racebook_is_live`.

The same approved-only dashboard exposes a manual `Notifier les coureurs` modal. The organizer selects the whole event or one format from the selected edition before sending. The route validates that the format belongs to the event, stores it as nullable `race_event_updates.race_id`, and uses the event or format name in the push title. Delivery still targets event followers; the payload includes `eventId`, `updateId`, optional `raceId`, and a catalog deep link. Delivery is logged in `push_notification_events` as `notification_kind = 'organizer-race-update'`. Each recent history card also has a compact delete cross; the `DELETE` handler repeats the organizer membership check and scopes the service-role deletion to both event id and update id.

The organizer write surface remains edition-aware for selection and grouping, but no longer becomes read-only based on `race_date`. Active event membership is the mutation authorization boundary for past and future editions.

For a brand-new organizer format, the add-format form may hold a pending image and GPX before submit. `OrganizerDashboard.tsx` parses GPX in-browser to prefill exact course metrics, defaults the race date from the selected edition, and reveals the date input only for an explicit override. The create route requires `editionId` and validates the date range before the existing image/GPX routes persist pending files. Existing-format GPX replacement keeps the same edition and refreshes returned metrics directly into the active form.

The completion shell intentionally omits a local "Avancement global" heading/helper line above the tabs. The active tab should stay larger and more contrasty than the inactive tabs, and desktop event tiles should fit on one row before wrapping.

The equipment editor layout should keep each item on one compact flexible row so the material name, weather toggles, status radios, and delete action stay in the same horizontal flow whenever width allows.

### Billing and Entitlements

Stripe routes live under `apps/web/app/api/stripe`:

- `checkout/route.ts`: creates subscription checkout sessions.
- `portal/route.ts`: creates billing portal sessions.
- `price/route.ts`: fetches the configured Stripe price and caches it for 5 minutes.
- `webhook/route.ts`: verifies Stripe signatures and updates `subscriptions`.

RevenueCat routes live under `apps/web/app/api/revenuecat`. They synchronize mobile purchases into the same `subscriptions` table with provider `google` or `apple`.

Resend contact sync lives under `apps/web/app/api/resend/contact/route.ts`. It validates the current Supabase bearer token, skips anonymous users, rate-limits by user id, and upserts a Resend contact using the server-only `RESEND_API_KEY`.

## Security Posture

Server routes generally use:

- `extractBearerToken` and `fetchSupabaseUser` from `apps/web/lib/supabase.ts`;
- `withSecurityHeaders` from `apps/web/lib/http.ts`;
- service-role requests only in server code;
- route-level rate limiting through `checkRateLimit` or `checkRateLimitAsync`.
- hashed secret-link lookups for public plan recaps; raw share tokens must not be stored in Supabase.
- narrow secret-link mutations for public crew tracking; `crew-state` may update only `departure_time` and `crew_state`.

See [../04-auth-and-security/rls-checklist.md](../04-auth-and-security/rls-checklist.md) before changing a route that bypasses client RLS.

## Gotchas

- Do not store service-role keys in client code. `getSupabaseServiceConfig` is server-only by usage.
- Do not expose `RESEND_API_KEY` to browser or mobile code; both clients must call server routes.
- `planner_values` is intentionally flexible JSON. Validate route inputs, but do not assume every old plan has every current field.
- `/api/race-catalog` and `/api/races` both write `races`, but the admin route creates public catalog rows and the user route creates private rows.
- Organizer routes can also write public `races`, but only after an active `race_event_organizers` membership check. Claimed public races should not rely on `races.created_by`.
- Keep organizer location text fields and their sibling geocoded JSON objects in sync. Publication checks still read the text columns/strings, while published GPS/Google affordances come from `organizer_details`.
- `race_events` is used by API routes, but this repo only shows a migration altering it, not creating it. See [../02-database/tables/race-events.md](../02-database/tables/race-events.md).
- Organizer event creation inserts a non-live `race_events` row and its owner `race_event_organizers` membership through a service route; keep that path server-side and do not expose service-role writes to client code.
- Admin organizer assignment must resolve the submitted e-mail through the server-only Supabase Auth Admin API. Return only the matched identity needed for confirmation, never the complete Auth user list or service credential.
- Website import upserts the validated canonical edition, attaches created/updated formats through `edition_id`, and reuses matching cross-year `edition_group_id` series instead of updating another edition's row.
- Do not convert a Trace de Trail `/iframe/{id}` path directly into `/trace/{id}`: iframe ids identify widgets and must first be resolved from the embed HTML. When a single-format page exposes several widgets, import only if they converge on one canonical trace.
- Current two-pass `additionalUrls` are evidence sources, not an authority boundary. Preserve the separate legacy `formatUrls` parser behavior only for backward-compatible one-pass callers.
- Keep `/organizer` compatible with production prerendering. Bootstrap query values should enter through the server page props; using `useSearchParams` directly in `OrganizerDashboard` requires a Suspense boundary and otherwise fails `next build`.
- Keep public catalog creation conservative by default: imported/admin-created events and races should start as non-live until someone publishes them deliberately.
- Organizer JSONB details are server-route managed progressive metadata. Keep public/mobile reads on explicit column lists so these draft details are not exposed by broad selects.
- Keep the emergency contact at event scope as `organizer_details.emergencyContact`; its phone is display-normalized but remains simple operational JSON rather than a normalized user/contact record, and mobile turns the published value into a `tel:` action.
- Course discovery and Racebook publication are separate contracts. Web catalog pages continue to use `is_live` / `is_public`; never substitute `racebook_is_live` into the SEO catalog filter.
- Keep bib pickup shared at event level in the current organizer UI. Its `locations[]` entries own their own geocoded address and `slots[]`; do not flatten several pickup places into one format-level string. Equipment is inherited by default; a format's `mandatoryEquipment.overrideEnabled` must be explicitly checked before its stored full list is used or edited.
- Preserve the tri-state compatibility of format equipment JSON: `true` is a full replacement, `false` is authoritative inheritance, and only a missing legacy flag may be inferred from old format-specific items or notes.
- Keep the active weather plan on the event-level equipment JSON. Formats may retag items for `cold` / `heat`, but they must not choose a different active plan than the event.
- Keep format access toggles and ravito timing cards aligned with completion/autosave logic; changing one without the others creates broken navigation or misleading scores.
- Keep Racebook switch saves scoped to the switched format. Do not foreground-save an unrelated active draft before publishing or hiding another format.
- Keep the organizer request body, server readiness query, stored publication request, and admin queue aligned on the same `race_id`; event-level inference reintroduces cross-edition publication bugs.
- The Ravitos save plan must PATCH the active race details before PUTting aid stations because start/finish times live in `races.organizer_details.schedule`, not on `race_aid_stations`.
- Relay-point writes must remain on the membership-checked service route. Do not grant organizer clients direct mutations or merge relay points into plan aid stations.
- Keep autosave dirtiness and revisions scoped by event/race, serialize background writes for the same scope, and suppress only success feedback. Errors and `beforeunload` protection must remain visible until the relevant scope is clean.
- Race sidecar and GPX loaders must compare their requested race id with the current active race before applying responses, because navigation no longer waits for prior network work.
- Keep organizer header completion counts format-scoped. The event detail response must retain each format's persisted ravito count so selecting another tab cannot transfer completion points.
- Keep organizer ravito cumulative D+ / D- GPX-driven while the current dashboard uses km-based interpolation from the preview trace; letting organizers override those fields manually would desynchronize the saved station metrics from the uploaded course.
- Keep a small UTF-8 regression test near organizer dashboard copy when editing French labels in route-local components; user-facing mojibake on ravito cards should be caught in CI, not by manual QA.
- Organizer-created products are non-live rows attached to source ravitos; do not expose them through public client env or the global catalog API.
- Organizer ravito product refresh is a read-time overlay on `/api/plans`; if the service-role refresh fails, return the stored `organizerAidStationProducts` snapshot instead of blocking plan load.
- Organizer GPX previews are recalculated from the private source GPX; do not add a `races.elevation_profile` column for this dashboard-only curve.
- GPX replacement must update the active distance/D+/D- form state from the successful response and keep the race edition year selected; an event refresh with the same race id does not trigger race-form initialization by itself.
- `react-leaflet` v5 expects React 19 and crashes this app's React 18 runtime during GPX map mount. Keep the organizer map on the React 18-compatible `react-leaflet` 4.x line until the web app itself upgrades React.
- Organizer event image upload accepts PNG only in v1; the client must call the server route instead of writing to Storage directly.
- Keep organizer dashboard French labels UTF-8 clean end-to-end, especially in `event-format-editors.tsx`; mojibake such as `Ã©` is a real regression on the event tab because those strings are rendered directly.
- Do not auto-send runner notifications on organizer save or publish. The manual event-update route is the only intended push trigger for this v1.
- Organizer update deletion must stay on the authenticated server route. Do not grant broad client delete access to `race_event_updates`, and do not treat deletion as a recall of already delivered pushes.
- Public plan share pages are unauthenticated by design, but they must display only the bounded snapshot in `plan_share_links`, not live editable plan data.
- Public plan share pages are standalone in `RootChrome` and force light theme variables so a visitor's saved dark preference does not affect crew readability.
- Set `PLAN_SHARE_TOKEN_SECRET` if reusable crew links must survive a service-role key rotation without creating one new stable link on the next re-share.
- Public crew-state updates use the URL token as the secret. Keep the route rate-limited and avoid adding fields that would let a crew viewer edit the private plan.

- Admin access to the complete Organizer event selector must continue to come from trusted `app_metadata` through `isAdminUser`; never broaden the catalog response for ordinary authenticated users.

## Related Docs

- [Session Management](../04-auth-and-security/session-management.md)
- [Auth Flows](../04-auth-and-security/auth-flows.md)
- [Plan Storage](../03-business-rules/plan-storage.md)
- [GPX Import](../03-business-rules/gpx-import.md)
- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
- [Stripe](../05-integrations/stripe.md)
