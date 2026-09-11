---
title: Web App Architecture
scope: architecture
last_verified: 2026-09-11
ai_priority: high
related_files:
  - apps/web/lib/organizer-structured-content.ts
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.tsx
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.test.ts
  - apps/web/app/organizer/_components/dashboard/organizer-import-documents.ts
  - apps/web/app/organizer/_components/dashboard/organizer-import-documents.test.ts
  - apps/web/app/api/organizer/editions/[id]/services/route.ts
  - apps/web/app/api/organizer/races/[id]/start-waves/route.ts
  - apps/web/app/api/organizer/races/[id]/awards/route.ts
  - apps/web/package.json
  - apps/web/playwright.organizer.config.ts
  - apps/web/e2e/organizer-payment.spec.ts
  - apps/web/tsconfig.json
  - apps/web/app/layout.tsx
  - apps/web/app/page.tsx
  - apps/web/app/seo.ts
  - apps/web/app/seo.test.ts
  - apps/web/lib/legacy-redirects.ts
  - apps/web/lib/redirect-integrity.test.ts
  - apps/web/app/localized-metadata.tsx
  - apps/web/app/support/page.tsx
  - apps/web/app/support/page-client.tsx
  - apps/web/app/partenaires/page.tsx
  - apps/web/app/en/partners/page.tsx
  - apps/web/components/landing/PartnersPage.tsx
  - apps/web/next.config.mjs
  - apps/web/app/admin/components/AdminRaceCatalogSection.tsx
  - apps/web/app/hooks/useVerifiedSession.tsx
  - apps/web/app/hooks/useOrganizerMembershipStatus.ts
  - apps/web/app/header-tabs.tsx
  - apps/web/app/header-menu.tsx
  - apps/web/components/SiteFooter.tsx
  - apps/web/app/robots.ts
  - apps/web/app/sitemap.ts
  - apps/web/app/sitemap.test.ts
  - apps/web/app/noindex-metadata.ts
  - apps/web/app/blog/page.tsx
  - apps/web/app/blog/[...slug]/page.tsx
  - apps/web/app/blog/blog-jsonld.test.ts
  - apps/web/components/BlogLayout.tsx
  - apps/web/components/BlogCard.tsx
  - apps/web/components/blog/RelatedPosts.tsx
  - apps/web/components/landing/GuideCards.tsx
  - apps/web/lib/blog/posts.tsx
  - apps/web/lib/blog/posts.test.ts
  - apps/web/lib/blog/posts-locale.test.ts
  - apps/web/app/courses/page.tsx
  - apps/web/app/courses/catalog-query.ts
  - apps/web/app/courses/catalog-query.test.ts
  - apps/web/app/courses/[slug]/page.tsx
  - apps/web/app/courses/[slug]/page.test.ts
  - apps/web/app/courses/[slug]/race-metadata.ts
  - apps/web/app/courses/[slug]/race-structured-data.ts
  - apps/web/app/courses/[slug]/race-structured-data.test.ts
  - apps/web/app/courses/_components/RaceCatalogFilter.tsx
  - apps/web/app/courses/_components/PublicRaceLinks.tsx
  - apps/web/app/courses/_components/PublicRaceShare.tsx
  - apps/web/app/courses/_components/PublicElevationProfile.tsx
  - apps/web/app/courses/_components/RaceHeroSummary.tsx
  - apps/web/app/courses/_components/RaceMetricsDetails.tsx
  - apps/web/app/courses/_components/RaceRouteExplorer.tsx
  - apps/web/app/courses/_components/RaceAidStationsTimeline.tsx
  - apps/web/app/courses/_components/RaceLinksCarousel.tsx
  - apps/web/components/ui/accordion.tsx
  - apps/web/app/courses/PublicRaceShare.test.ts
  - apps/web/app/courses/distances/[category]/page.tsx
  - apps/web/app/courses/race-discovery.test.ts
  - apps/web/app/calculateur-glucides-trail/page.tsx
  - apps/web/app/calculateur-glucides-trail/CarbCalculator.tsx
  - apps/web/app/calculateur-glucides-trail/carb-calculator-fun.test.ts
  - apps/web/app/a-propos/page.tsx
  - apps/web/app/methodologie/page.tsx
  - apps/web/app/(planner)/race-planner/page.tsx
  - apps/web/app/(planner)/race-planner/page.test.ts
  - apps/web/app/(planner)/race-planner/planner-seo.tsx
  - apps/web/app/legal/metadata.ts
  - apps/web/app/legal/metadata.test.ts
  - apps/web/app/legal/mentions-legales/page.tsx
  - apps/web/app/legal/cgu/page.tsx
  - apps/web/app/legal/cgv/page.tsx
  - apps/web/app/legal/privacy/page.tsx
  - apps/web/lib/public-races.ts
  - apps/web/lib/public-races.test.ts
  - apps/web/lib/public-race-detail.ts
  - apps/web/lib/public-race-detail.test.ts
  - apps/web/lib/race-discovery.ts
  - apps/web/lib/carb-calculator.ts
  - apps/web/lib/carb-calculator-fun.ts
  - apps/web/app/api/auth/session/route.ts
  - apps/web/app/api/resend/contact/route.ts
  - apps/web/lib/entitlements-client.ts
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
  - apps/web/app/organisateurs/page.tsx
  - apps/web/app/organisateurs/organizer-landing-page.tsx
  - apps/web/app/organisateurs/organizer-landing-page.test.ts
  - apps/web/app/organizers/page.tsx
  - apps/web/app/organizers/layout.tsx
  - apps/web/app/(planner)/race-planner/print/assistance/page.tsx
  - apps/web/lib/organizer-acquisition.ts
  - apps/web/lib/organizer-acquisition.test.ts
  - apps/web/app/organizer/page.tsx
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/lib/organizer-publication-tier.ts
  - apps/web/lib/organizer-publication-tier.test.ts
  - apps/web/app/organizer/_components/dashboard/types.ts
  - apps/web/app/organizer/_components/dashboard/constants.ts
  - apps/web/app/organizer/_components/dashboard/helpers.ts
  - apps/web/app/organizer/_components/dashboard/helpers.test.ts
  - apps/web/app/organizer/_components/dashboard/data-cache.ts
  - apps/web/app/organizer/_components/dashboard/data-cache.test.ts
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
  - apps/web/app/organizer/_components/dashboard/sponsors-editor.tsx
  - apps/web/app/organizer/_components/dashboard/branding-editor.tsx
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
  - apps/web/app/api/organizer/bootstrap/route.ts
  - apps/web/app/api/organizer/bootstrap/route.test.ts
  - apps/web/app/api/admin/organizer-payments/route.ts
  - apps/web/app/api/admin/organizer-payments/[paymentId]/invoice/route.ts
  - apps/web/app/api/organizer/invoices/route.ts
  - apps/web/app/api/organizer/invoices/[paymentId]/download/route.ts
  - apps/web/app/organizer/_components/dashboard/invoices-dialog.tsx
  - apps/web/lib/organizer-payments.ts
  - apps/web/lib/organizer-invoices.ts
  - apps/web/app/api/organizer/edition-requests/route.ts
  - apps/web/app/api/organizer/edition-requests/route.test.ts
  - apps/web/app/api/organizer/editions/[id]/route.ts
  - apps/web/app/api/organizer/editions/[id]/route.test.ts
  - apps/web/app/api/organizer/editions/[id]/sponsors/route.ts
  - apps/web/app/api/organizer/editions/[id]/sponsors/[sponsorId]/route.ts
  - apps/web/app/api/organizer/editions/[id]/branding/route.ts
  - apps/web/app/api/organizer/editions/[id]/branding/route.test.ts
  - apps/web/app/api/racebook-sponsors/route.ts
  - apps/web/app/api/racebook-sponsors/[id]/click/route.ts
  - apps/web/lib/racebook-sponsors.ts
  - apps/web/lib/racebook-branding.ts
  - apps/web/lib/racebook-branding.test.ts
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
  - supabase/migrations/20260910081049_add_atomic_organizer_course_collections.sql
  - supabase/tests/organizer_atomic_course_collections_checks.sql
  - apps/web/app/api/location-search/route.ts
  - apps/web/lib/organizer-website-import.ts
  - apps/web/lib/organizer-publication.ts
  - apps/web/app/api/plans/from-catalog/route.test.ts
  - apps/web/app/api/stripe/checkout/route.ts
  - apps/web/lib/location-utils.ts
  - apps/web/lib/push.ts
  - apps/web/lib/organizer-entitlements.ts
  - apps/web/app/api/organizer/publication-checkout/route.ts
  - apps/web/app/api/organizer/publication-checkout/route.test.ts
  - apps/web/app/api/organizer/events/[id]/onboarding/route.ts
  - apps/web/app/api/organizer/events/[id]/onboarding/route.test.ts
  - apps/web/app/organizer/_components/dashboard/onboarding.ts
  - apps/web/app/organizer/_components/dashboard/onboarding.test.ts
  - apps/web/components/race-planner/OnboardingOverlay.tsx
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
  - race_slug_redirects
  - race_event_edition_sponsors
  - race_event_edition_branding
---

# Web App Architecture

The organizer dashboard code-splits its heavy module editors and review panels, then loads module data only when needed. Structured collection autosaves are serialized and revision-aware, so an older server response cannot overwrite edits made during the request. Late dashboard responses are abortable and scoped to the active event/race. Aid-station, station-product, relay-point and sponsor-order mutations use service-only atomic database functions instead of write loops. The bootstrap embeds only lightweight status projections, so every tile is correct on first render without downloading editable collections. The shared module catalog separates selected authoring state from effective public state: inactive tiles leave navigation, while `draftOnly` tiles remain editable and are filtered from runner responses until the required offer becomes active.

The dashboard uses progressive disclosure for secondary guidance: controls keep short labels, while reusable contextual help exposes longer explanations on pointer hover and keyboard/touch focus. Validation errors, missing-data warnings, save state, and actual event values remain visible because they require immediate attention and must not depend on hover.

The event information editor uses five ordered visual sections instead of one flat grid: primary identity, online presence, edition dates, emergency contact, and cover image. The emergency block has a restrained warning surface, while the image preview and picker share one bounded row so neither creates unused page width.

The edition-level RaceBook branding editor is another lazy event module. It keeps local primary/accent edits separate from its saved draft, previews both interaction colors and accent-tinted information surfaces, and publishes only through the atomic database RPC. Edition-logo upload infrastructure and stored values remain intact, but the shared kill switch currently hides its controls and prevents public resolution. Non-Pro organizers receive an upsell instead of draft data.

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
- `npm run test:e2e:organizer-payment --workspace apps/web` (explicit Stripe-test opt-in and credentials required)
- `npm run typecheck --workspace apps/web`

The current web stack still runs on `react` / `react-dom` `18.3.1`. Any browser map bindings added under `apps/web` must stay compatible with React 18 until the app is upgraded; for Leaflet route previews that means staying on the React 18-compatible `react-leaflet` line rather than the React 19-only v5 releases.

The production web TypeScript project excludes `*.test.ts` and `*.test.tsx` files. Vitest remains responsible for compiling and running those tests; this prevents a web-only Next.js build from following test imports into mobile-only Expo modules whose dependencies are intentionally absent from the web deployment.

`apps/web/next.config.mjs` enables:

- optional MDX page support when MDX dependencies are available;
- `experimental.typedRoutes = true`;
- `eslint.ignoreDuringBuilds = true`;
- transpilation of `@trailplanner/shared` and `@pace-yourself/design-system`;
- custom SVG handling through SVGR for component imports.
- a route-scoped `Content-Language: en` response header for `/en/*` without reading request headers in the root layout.

## Main Runtime Areas

### Organizer Information Import

The organizer dashboard action is named `Importer les informations` and is visible and callable only to a trusted admin. Its source step accepts an optional main website URL, up to twelve additional official URLs of any useful role, and up to eight PDF/image selections capped at 25 MB each. Additional URLs may be event, regulation, program, logistics, registration, archive, or format pages; their presence never asserts that each URL is one format. The browser uploads documents directly to the private `organizer-imports` Storage bucket through resumable TUS transfers with 6 MB chunks, retry, progress, cancellation and cleanup, then sends only their temporary paths to the API. The session manifest retains those paths only for the two review passes; apply, cancel, or expiry cleanup deletes the objects. A document-only discovery remains possible without a website URL.

The workflow has two reviews. Format discovery comes first and reports existence confidence independently from field completeness. It does not merge anonymous or named candidates from distance alone, and it keeps incomplete candidates available for confirmation. The admin confirms the final format count, bindings, names, additions, and ignores before field enrichment begins.

Enrichment converts website, structured data, GPX, current Organizer data, previous-edition references, and paginated PDF findings into typed source claims. PDF findings keep a match-centered excerpt capped at 2,000 characters for evidence and 500 for the typed value; equivalent document claims are deduplicated and limited to eight per scope and field for each document. The review displays current value, alternatives, source URL or document/page, evidence, confidence, conflicts, and missing fields for every confirmed format. New formats may stay incomplete hidden drafts. OCR for images and scanned PDFs remains pending.

For generic pages and extracted text PDFs, a bounded deterministic pass first classifies each source and extracts explicit assertions. The main page itself contributes explicit heading-based formats (including event-prefixed KMS labels such as `Event:Trail 16KM 385m D+`), and up to two same-origin linked PDFs are downloaded only when their URL or link explicitly identifies a PDF, capped at 25 MB and 100 pages. A page with several explicit named distances is classified as multi-format before repeated registration navigation can misclassify it. OpenAI is then used only for ambiguous or incomplete sources, with strict grounded output: values, evidence, and named formats must occur in the source. Registration/results/unusable pages are reported but cannot manufacture formats or course claims. The source pass is capped at twelve sources and 48,000 total characters, cached for 30 minutes by content/model hash, and persisted as signed claims for the second pass. Separately, field conflict reconciliation can return only an existing applicable `claimId` or `uncertain`; it cannot return a value or select a previous-edition reference claim. Distance concordance uses `max(0.5 km, 2%)`, and D+/D- use `max(100 m, 8%)`. Only a high-confidence, conflict-free fill of an empty field may be preselected.

### Authentication and Session

The client session entry point is `apps/web/app/hooks/useVerifiedSession.tsx`. It:

- reads and writes tokens through `apps/web/lib/auth-storage.ts`;
- verifies access tokens by calling `apps/web/app/api/auth/session/route.ts`;
- passes refresh tokens through the `x-refresh-token` header when needed;
- fetches entitlements through `apps/web/lib/entitlements-client.ts` after verification without keeping the verified-session loading state active;
- triggers the authenticated Resend contact sync for identified, non-anonymous sessions;
- clears planner local storage on sign-out.
- reruns verification from the latest stored token when a session-update event overlaps an older in-flight request.

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

The public client emits consent-gated, aggregate-only crew engagement events for link opening and successful state mutations. The URL token, plan identity, snapshot content, and individual passage details never leave the server-rendered secret-link boundary as analytics properties.

### Race Catalog and GPX

Catalog reads tolerate an officially unpublished D+ as `null`. Runner and admin surfaces display it as not supplied (never as zero or `NaN`), and catalog plan creation remains unavailable until a real elevation value exists.

Admin catalog creation lives in `apps/web/app/api/race-catalog/route.ts`. It requires an admin user, validates GPX, can create a `race_events` row, uploads GPX to the private `race-gpx` bucket, uploads images to `race-images`, and inserts `races` plus `race_aid_stations`. New event/race rows from this flow should start as draft (`is_live = false`) unless the admin explicitly marks them live.

The Trace de Trail admin dialog uses `/api/admin/race-catalog/tracedetrail` for preview, import, and direct GPX download. The adapter tries authenticated then public provider downloads and may rebuild a GPX from geometry already embedded in the accessible trace page. Direct download returns the GPX without database or Storage writes. Catalog creation initializes the required edition-series fields for the first imported edition.

User-created private races live in `apps/web/app/api/races/route.ts`. They are inserted with `is_public: false` and `created_by` set to the authenticated user.

### Public SEO Routes

The canonical homepage is French-first even though the product name is English. Its server-rendered metadata advertises `fr-FR` plus an `x-default` pointing to the same canonical URL, and the client locale helper must not replace the homepage title, description, or canonical after hydration. This keeps crawler-visible language signals stable until a genuine server-rendered English homepage has its own URL.

`/support` is a French canonical route with stable French server metadata; the client locale switch no longer mutates its canonical or metadata after hydration. The French `/partenaires` and English `/en/partners` routes publish reciprocal `fr-FR`/`en-US` hreflang entries plus the French `x-default`, and their content roots carry the matching `lang`. The `/en/*` response header adds the server-visible English signal while the shared root layout remains static.

Public metadata uses `/landing/secondary.png` as the shared Open Graph/Twitter fallback. Routes with their own course or article image keep that specific asset; public landing pages and image-less races use the shared fallback instead of emitting an image-less social card.

Blog frontmatter supports an explicit `locale` of `fr` or `en` and otherwise defaults to French. Article metadata, Open Graph locale, visible byline/CTA/reading-time/related-post copy, `hreflang`, and `BlogPosting.inLanguage` all use that stored locale rather than guessing from accents or tags. `BlogPosting` identifies the verifiable Pace Yourself organization and its About page; no personal qualification is inferred. Its safely escaped JSON-LD is emitted by the server in the initial HTML rather than injected after hydration, and homepage guide cards never expose a technical slug as editorial copy.

`/organisateurs` is the French, indexable organizer-acquisition landing page. It explains the mobile Racebook with four real TST mobile screenshots (course and aid stations, bib collection, equipment, and access), keeps `/organizers` as the authenticated event-creation form, and sends its secondary CTA to the production Google Play listing. The TST section gives the exact in-app path: open Courses, search for `Trail TST`, select one of its three formats, then press `Racebook`. The selected screenshot is shown in full with a viewport-constrained height so the selector and preview remain usable together. The footer links to the landing page while the authenticated header continues to route "Mes courses" to `/organizers` or `/organizer` according to membership state. Only the supported UTM keys are forwarded to the creation flow.

The public race discovery surface lives at `/courses`. It loads only rows where both `races.is_live` and `races.is_public` are true through the Supabase anon key, using explicit public column selects. Search, distance, period, grouping, and pagination are computed on the server, and only 12 event-edition groups are serialized per response; none of the complete `PublicRace` collection is sent as client-component props. The server-rendered page emits a page-scoped `ItemList`, ordinary crawlable course links, and `prev`/`next` pagination links. Filtered query combinations are `noindex,follow` with `/courses` as canonical; unfiltered numbered pages keep their own canonical and out-of-range pages return not found. Text search covers the format name/location, parent event name/location, and the event's normalized city, department, region, and country. It is accent- and punctuation-insensitive and treats entered words independently, so administrative names remain findable in any order. The default view puts upcoming/current formats before undated formats, while the past view sorts newest first. After filtering, formats sharing a stable non-null `eventId + editionId` render inside one semantic event-edition card ordered by distance; legacy event rows without an edition fall back to `eventId`, and standalone races remain separate cards. Event and format image URLs stay distinct, missing images reserve no space, and every format keeps a crawlable course link.

Each live public race has a canonical `/courses/[slug]` page. Known slugs are returned from `generateStaticParams`; the catalog, detail pages, and sitemap revalidate every 15 minutes, and uncached slugs remain resolvable at runtime. A former slug is looked up in `race_slug_redirects`, revalidated against the current race and optional parent-event visibility, and permanently redirected before rich data is loaded. Course metadata keeps titles at 60 characters and descriptions at 160 characters. The title reserves a factual distance/year suffix and truncates the middle of long race names, preserving both the event prefix and the distinguishing format code or name at the end.

The lightweight catalog DTO and server-only detail DTO are deliberately separate. The detail service rechecks live/public race, live parent event, and visible edition before service-role organizer, ravito, or private GPX reads. It applies the shared inheritance parser but serializes only an explicit runner-safe shape: emergency phone, `lastMinuteMessage`, raw organizer JSON, GPX paths and GPX source content never reach client components. A valid private GPX is parsed on the server and reduced to about 600 route/profile points; invalid GPX removes only that visualization. Detail pages add `BreadcrumbList` JSON-LD and add factual `SportsEvent` JSON-LD only when the format has a valid calendar date in strict `YYYY-MM-DD` form. They also provide Open Graph/Twitter image fallbacks, responsive map/profile and ravito cards, native/Facebook/copy sharing, same-edition formats, similar races, distinct official sources, and a planner link carrying `catalogRaceId`.

The detail page hierarchy is decision-first: `RaceHeroSummary` renders the compact hero image, title, date/location, prominent distance + D+, the planner CTA, an icon-only `PublicRaceShare` (`variant="icon"`), and other-format pills above the fold; `RaceMetricsDetails` collapses D−/altitude min/max behind a native `<details>`. Below the hero, a mobile-only anchor nav (`#route`/`#ravitos`/`#infos-pratiques`) jumps to the route section (map + elevation profile stacked full-width, with a desktop sticky "Informations clés" aside), the `RaceAidStationsTimeline` (vertical timeline replacing the old ravito grid), and an `Informations pratiques` block built from reusable `AccordionItem`s, each with a category icon and split into two visually distinct groups: "Essentiel pour courir" (schedule and access open by default, bib pickup opens automatically within 14 days of race day, each showing a one-line collapsed summary) and "Informations complémentaires" (equipment/services/runner-info, collapsed, no summary). Equipment items show a colored "Obligatoire"/"Recommandé" badge instead of inline text, binary bib-pickup answers (third-party pickup, equipment check) use the same badge pattern, and every external map link (départ/arrivée/parking access, bib pickup location) renders as a bordered button with an icon instead of a plain underlined link. The route map uses `RaceRouteExplorer`, a client wrapper that keeps `GpxRouteMapClient` non-interactive until the runner taps "Explorer la carte", so page scroll on mobile is never captured by the map. All accordion/timeline content stays in the server-rendered HTML for SEO; only visibility toggles via native `<details>`. A closing "Autres courses à découvrir" block sits in its own muted, rounded container to separate discovery links from this race's own information, rendering "Autres formats" and "Courses de distance similaire" as horizontal scroll-snap carousels (`RaceLinksCarousel`) rather than the grid used on `/courses/distances/[category]` (which keeps `PublicRaceLinks`, the original grid component).

Every detail page also renders a factual overview from its verified event, date, location, distance, and D+ so formats without GPX still expose useful race-specific copy. When eligible, `SportsEvent` JSON-LD includes a canonical entity id and a physical `Place` with `PostalAddress`; without a valid `startDate`, the complete event item is omitted while `BreadcrumbList` remains. It intentionally omits the edition end date because an event weekend does not prove an individual format's finish date. Mobile anchor navigation links only to sections present in the HTML.

`/courses/distances/[category]` provides crawlable discovery pages for short trails, 30–79 km trails, and ultra-trails. A category is generated, linked, and included in the sitemap only when at least five published races have a structured distance in its mutually exclusive range. The lightweight public catalog contract now exposes normalized locality names only for in-memory search; crawlable region pages remain disabled until their stable-code routing and minimum-content rules are implemented. Free-text locations are not used to manufacture geographic landing pages.

`/calculateur-glucides-trail` is a public server-rendered landing page with an interactive client calculator. Duration, distance, elevation gain, and digestive-tolerance sliders keep their visible values, but the nutrition result remains hidden until the runner starts an explicit calculation. A short client-only loading state reveals the estimate and one intentionally unfair elite pace comparison. The comparison is deliberately compact: one projected time-gap headline followed by one larger randomized trail mishap. Changing any slider invalidates the displayed result. Distance and elevation provide comparison context only; they do not alter the carbohydrate estimate.

`/race-planner` keeps the interactive planner behind its existing Suspense boundary but renders a useful French H1, summary and capability list as the server fallback. Its `SoftwareApplication` JSON-LD is emitted server-side so crawlers receive both the structured data and useful page content in the initial HTML.

The calculator's bounded duration/tolerance interpolation lives in `apps/web/lib/carb-calculator.ts` and is documented separately from the full planner allocation rule. Its share links are stateless: `duration`, `tolerance`, `distance`, `elevation`, and stable `comparison` / `joke` ids reproduce the same estimate and copy. The client accepts only in-range, step-aligned values and known ids; invalid or incomplete query strings fall back to the untouched calculator. Sharing uses the browser Web Share API when available and clipboard copy otherwise, without a database write.

`/a-propos` and `/methodologie` explain the product mission, editorial safeguards, calculator assumptions, source policy, and correction path. They are linked from the global footer and included in the sitemap to provide public trust and provenance signals.

`sitemap.ts` includes the organizer landing page, Premium, French and English partner acquisition, support, race catalog, every currently published race slug, qualified distance pages, the calculator, trust pages, and existing blog pages. Race URLs use the latest format/event `updated_at` as evidence-based `<lastmod>`; distance landing pages use the newest timestamp among their listed races. Blog discovery resolves `content/blog` from both the web workspace and monorepo/runtime ancestors and fails explicitly when the directory is absent, preventing a successful but empty blog sitemap. `robots.ts` permits public crawling but excludes `/api/`. Account, admin, onboarding, organizer-dashboard, organizer-creation, planner-print, and token-share route layouts reuse `noindex-metadata.ts`; they remain crawlable so search engines can observe the noindex directive, but should not remain in the index. The four legal routes use distinct self-canonicals and remain `noindex,follow` until their complete regulatory identity and hosting details receive maintainer/legal validation.

### Organizer Portal

The admin Organizer area separates publication and membership work into `Publier le RaceBook` and `Accès organisateurs`. Direct e-mail assignment performs the Auth lookup only in the protected server route. A missing account returns a bounded not-found response that opens a cancel/create dialog; confirmation calls the route again, creates the Supabase account through the server-side invitation endpoint, sends the invite, and then inserts the event membership. The browser never receives the service credential or an Auth user list.

For trusted admins, the organizer header also exposes `Importer les informations`. That flow posts to `/api/organizer/events/[id]/website-import`, reuses the existing UTMB / Trace de Trail import adapters when possible, and falls back to generic HTML/JSON-LD extraction. It is review-first in two passes: source discovery writes no race data; confirming the final format list atomically binds existing rows or creates hidden drafts; applying reviewed fields later enriches only that event and those confirmed formats. It must never create another event row or publish a Racebook automatically. Historical drafts are importable even after the normal edition edit window has elapsed.

The Organizer header keeps only the selected event/edition, completion, primary publication CTA, and a secondary `Actions` menu visible. Notification, import, edition/event creation, and destructive actions live in that menu; typed confirmations remain mandatory. The collapsed visibility panel retains the edition-wide catalog switch and gives each format one accessible three-state radio control: `Masqué` sets both preview and runner visibility off, `Privé` keeps only organizer preview, and `Public` requests entitlement-checked runner publication. `POST /api/organizer/editions/[id]/publication` still atomically publishes all selected complete formats from the primary CTA. `PATCH /api/organizer/editions/[id]` hides or restores complete course rows after active membership validation; hiding always forces attached Racebooks off. Edition `DELETE` invokes the atomic service-only deletion RPC, cleans up format GPX/images, and returns the remaining year the dashboard should select.

The organizer dashboard reuses the shared planner spotlight overlay for a six-step first-arrival guide. `GET /api/organizer/bootstrap` includes the membership's nullable onboarding timestamp; the client opens the guide only after the selected event and completion surface are ready. `PATCH /api/organizer/events/[id]/onboarding` stamps the active user's membership idempotently when the guide is finished, skipped, or closed. Admin selector rows remain synthetic and are excluded from automatic display. `Actions > Revoir le guide` is presentation-only and leaves the stored first completion unchanged.

The publication dialog captures the selected event id, canonical edition id, year, and effective tier when it opens, displays the event/year context, and reuses that stable snapshot for checkout. It explicitly overrides the shared dialog's narrow default width, keeps its header fixed, bounds itself to the viewport, and gives the commercial cards and optional admin partner actions one internal scroll region. It shows Essential, Complete and Signature only when publication starts from Visibilité; an already-active paid or complimentary tier publishes directly, while effective-module serialization withholds higher-tier drafts. A verified admin may open the separate upgrade flow and use the same snapshot to grant a higher tier without Stripe; ordinary organizers never receive that section. Dated legacy/imported formats missing `edition_id` are repaired by the canonical-edition backfill rather than billed or granted from a year-only browser guess.

The post-analysis recap uses a viewport-bounded flex dialog: its header and validation actions stay fixed while the center review panel owns vertical scrolling. The flex display is explicitly prioritized because the shared `cn` helper concatenates utility classes and does not resolve a route-level `flex` against the dialog primitive's default `grid` class.

Each detected format carries existence evidence plus a separate completeness summary. Scores may help order the review but are not a visibility or creation threshold. The first step exposes all credible candidates so the admin can confirm the count, merge/split detections, bind an existing format, add a missing format, or ignore a false positive. A candidate remains confirmable without date, distance, D+, or GPX.

For non-provider sites, the general URL remains the primary source for event-level facts and common logistics and can also yield structured format blocks. The importer discovers a bounded set of hint-matched same-origin pages and combines them with the explicitly supplied additional official URLs. Every fetched page is classified by role before its grounded assertions are promoted. Only compatible event/format/regulation evidence with an explicit name can add a format candidate; registration deadlines, result archives, unrelated logistics, and unnamed distances cannot. Extraction otherwise combines JSON-LD, accessible tabs, embedded GeoJSON, headings, named regulation prose, and bounded LLM assistance. Candidate consolidation requires compatible normalized identity evidence. Anonymous same-distance detections remain separate for the admin, and proximity alone never attaches a GPX to a named candidate across pages. The legacy one-pass `formatUrls` request remains readable as its former authoritative compatibility mode, but the current two-pass UI writes `additionalUrls`.

GPX detection accepts explicit `.gpx` URLs, labeled download anchors, supported Trace de Trail embeds, and complete public GeoJSON route geometry. Recovered geometry is parsed through the normal GPX pipeline and becomes a high-confidence claim only after unambiguous format association. The importer never guesses absent elevation data or reconstructs routes from map tiles/screenshots. Incomplete confirmed formats may still be created as hidden drafts; a format without GPX keeps its GPX path and hash columns null because GPX is not part of the catalog publication minimum.

The v1 organizer portal is web-only:

- For a trusted admin, `/api/organizer/claims` replaces the membership-limited selector data with every `race_events` row ordered by name, including drafts. The downstream Organizer detail and mutation routes use the same admin bypass through `requireEventOrganizer`; non-admin selector data remains membership-scoped.
- `GET /api/organizer/bootstrap` verifies the bearer token once, returns the same claims, memberships, edition requests, and publication requests as `GET /api/organizer/claims`, then includes the selected authorized event detail. It deliberately excludes GPX, products, ravitos, relay points, updates, and follower data. The client loads GPX only for the Course or Ravitos module, loads the race sidecars and product catalog only for Ravitos/Products, and loads runner updates/follower totals only when their dialog opens. An explicit `eventId` must belong to the returned active memberships, except for trusted admins whose selector represents the complete event catalog; without an id, the first selectable event is used, and `event` is `null` when none exists.
- The same bootstrap membership projection includes `dashboard_onboarding_completed_at`. It is per user/event and remains null on synthetic admin rows; it is not event content or an edition-wide setup flag.
- The route-local Organizer data cache keeps the product catalog for 5 minutes, complete ravito/relay/station-product sidecars per race for 2 minutes, and GPX previews for 10 minutes. Its LRU bounds retain at most 20 sidecar races, 20 GPX races and three GPX paths per race. GPX entries are keyed by both race id and `gpx_storage_path`, so a replaced source path cannot reuse the previous preview. Organizer mutations invalidate the affected race entry, and a session boundary clears the complete cache.

- `/organizers` creates a new catalog-visible event through `POST /api/organizer/events` and immediately creates its active owner membership; its new formats remain private until explicit publication. It does not claim existing catalog events, expose the admin-only URL importer, or send `officialSiteUrl` during creation. After success it redirects to `/organizer` with only the new event selected. The `/organizer` server page still normalizes legacy/admin `eventId` and `importUrl` values from its `searchParams` prop before passing them to the client dashboard, which keeps the route compatible with static generation without a client-side search-param bailout.
- `/organizer` lets active event members maintain catalog-visible events, canonical `race_event_editions` ranges, and attached formats. Its header is task-first: one compact searchable event combobox, the edition selector, one completion bar, one publication CTA, then a secondary action menu. The same event field opens the authorized list and filters it while the user types; its listbox remains keyboard navigable. The visibility panel is closed by default and maps each format's persisted booleans to `Masqué`, `Privé`, or `Public`; moving from Public to Privé explicitly clears `racebook_is_live` without hiding the private demo. The format workspace keeps every selected-edition format visible to authorized organizers/admins: masked choices are grey with `Course masquée pour le public`, private choices show `RaceBook privé`, and public choices show `Course et RaceBook publics`, including in the responsive native selector. The compatibility `/api/organizer/edition-requests` URL creates the edition either empty or with cloned formats and no longer writes the retired review table. Essential, Complete or Signature remains required for Public, and admin/legacy-admin grants remain auditable complimentary access.
- In a selected format tab, the required module card is named `Course`. The `Formats & GPX` editor stays permanently expanded, has no internal runner-preview or single-format duplication action, and aligns the destructive format-delete action at the far right of its title row. Its former helper description is intentionally omitted. Format dates and locations inherit respectively from the selected edition and event until the organizer enables their explicit `Date différente` or `Lieu différent` controls.
- The format information grid exposes one `Nom du format` input. Its client state and save payload keep `races.name` and `races.series_name` identical, while `edition_group_id` remains the stable cross-year grouping key.
- The organizer dashboard now uses a route-local address autocomplete field for event location, format location, bib pickup, and start/finish access addresses. Bib pickup accepts several event-level locations, each with several structured date/start/end slots; the legacy single location and free-text schedule remain readable as compatibility fallbacks. The editor calls `/api/location-search`, keeps the first bib location mirrored into the legacy text/location fields, and stores the complete location and slot list in `organizer_details` so published runner surfaces can expose every address, GPS link, day, and time range.
- The Organizer access form groups its unchanged `organizer_details.access` fields in the same runner-facing order used by mobile: locations/map, priority information/restrictions, then parking/navettes. Section switches sit with the group they control; no extra table or JSON key is introduced by this visual hierarchy.
- The event `Informations` editor stores the optional official website, Instagram URL, Facebook URL, and a structured emergency contact name and phone in `race_events.organizer_details`. The shared parser adds `https://` to valid domain links pasted without a protocol, rejects invalid or non-HTTP(S) values, and normalizes French phone inputs to the canonical `+33 X XX XX XX XX` display. These values stay behind the existing organizer membership-checked event route; no separate event column or client-side Supabase write is introduced.
- The organizer creation screen and dashboard keep concise, consistently accented French copy across `/organizers` and `/organizer`.
- The main header always shows "Mes courses" / "My races". It opens `/organizers` to let a new organizer create their first event, then opens `/organizer` after `/api/organizer/claims` reports at least one active membership.
- `apps/web/lib/organizer.ts` centralizes bearer-token verification, admin checks, service headers, and event-membership checks.
- `/api/organizer/*` routes verify the current Supabase user and then use the service role for authorized mutations.
- `/api/organizer/events/[id]/updates` returns recent announcements plus an aggregate follower count. Its Supabase REST read requests `count=exact` with a one-row range, so the server does not transfer the full cross-user favorite list.
- `/api/race-favorites` is the authenticated runner bridge for favoriting `race_events`, and `/api/race-events/[id]/updates` is the runner/mobile read route for the latest published organizer announcements on live events.
- `/api/admin/organizer-claims` keeps legacy access-claim review and membership revocation, and lets a trusted admin attach an existing Supabase Auth e-mail to an event as an `organizer`. Auth-user lookup and membership writes stay server-side; direct assignment grants edit access without changing catalog/Racebook state. `/api/admin/event-publication-requests` returns the pending queue plus every event's current-edition Racebook state. Approval invokes the service-role-only review function; the admin event switch invokes a separate service-role-only function to publish or hide Racebooks; and `setEditionTier` invokes the audited entitlement RPC used by both the admin tab and the `/organizer` partner-publication action.

Organizer edits are source edits for `race_events`, `race_event_editions`, `races`, `race_aid_stations`, `race_relay_points`, and station products. Active membership authorizes private draft authoring, including modules above the current offer. Public publication and costly operations remain behind centralized edition capabilities; public serializers combine the publication flag, entitlement tier, and selected module before returning content.

Inside the format-level `Départ, ravitos & relais` editor, the common start and finish schedule cards render above the local `SAS`, `Ravitos` and conditional `Relais` tabs. When at least one SAS exists, its earliest native time is displayed as the format start and the common start field is disabled; removing the last SAS restores manual editing without clearing the stored time. The contextual add action follows the active list tab. `Relais` shows compact derived legs in one horizontal row above the handover-point editor; handover cards expose only the point name, distance, cutoff, and a compact delete cross, while the persisted optional passage time and notes remain outside the current editor. Solo formats omit only the relay tab. This split is presentation-only and does not change the existing race-details, aid-station, or relay-point save order.

The same approved-only dashboard exposes a manual `Notifier les coureurs` modal. The organizer selects the whole event or one format from the selected edition before sending. The route validates that the format belongs to the event, stores it as nullable `race_event_updates.race_id`, and uses the event or format name in the push title. Delivery still targets event followers; the payload includes `eventId`, `updateId`, optional `raceId`, and a catalog deep link. Delivery is logged in `push_notification_events` as `notification_kind = 'organizer-race-update'`. Each recent history card also has a compact delete cross; the `DELETE` handler repeats the organizer membership check and scopes the service-role deletion to both event id and update id.

The organizer write surface remains edition-aware for selection and grouping, but no longer becomes read-only based on `race_date`. Active event membership is the mutation authorization boundary for past and future editions.

For a brand-new organizer format, the add-format form may hold a pending image and GPX before submit. `OrganizerDashboard.tsx` parses GPX in-browser to prefill exact course metrics, defaults the race date from the selected edition, persists the effective inherited event location, and exposes the official source required by catalog publication. The create route requires `editionId` and validates the date range before the existing image/GPX routes persist pending files. Existing-format GPX replacement keeps the same edition and refreshes returned metrics directly into the active form. Pricing stays closed until a local prerequisite check finds at least one publishable format; the server still revalidates persisted data before checkout.

`apps/web/e2e/organizer-payment.spec.ts` covers the public organizer hero, password sign-in, TEST event and format creation, Stripe test-card payment, webhook-confirmed entitlement, and UI deletion. Its fallback API cleanup runs even after a failed assertion.

The completion shell intentionally omits a local "Avancement global" heading/helper line above the tabs. The task-first header exposes completion once, keeps publication primary, groups rare actions, and starts detailed visibility collapsed. Dirty work displays a fixed save bar. Scope navigation is split explicitly between `Informations communes` / `Commun à toutes les courses` and `Formats de course`; mobile mirrors the same hierarchy with labelled option groups and an explicit `Ajouter un format` option. Module tiles contain only their emphasized title, content summary, and actionable missing-field text. Grey, amber, and green surfaces mean empty, partial, and complete; the active tile adds a strong brand ring independently of completion color.

Format-level detail modules keep their context in the main card header instead of repeating it inside a nested panel. `Dossard`, `Matériel`, and `Accès` display their `<module> - <format>` title with the corresponding format-specific override control right-aligned in that header. Their fields render directly in the module content area only while the override is enabled; otherwise the format inherits the event value.

The equipment editor layout should keep each item on one compact flexible row so the material name, weather toggles, status radios, and delete action stay in the same horizontal flow whenever width allows.

### RaceBook Sponsor Routes

The optional Organizer `Sponsors` tile is Pro-only. Visibilité and RaceBook editions see a Pro upsell and never mount the editor. With Pro active, opening the tile lazily reads the selected edition's list, while metadata blur/save, placement toggles, logo replacement, and deletion use edition routes that repeat both active-membership and `sponsors.manage` checks. Ordering submits the complete list to one service-only transaction; partial lists, foreign ids and duplicate positions are rejected. The same tile reports active rows and aggregate raw clicks. All database and `race-images/organizer-sponsors/{editionId}/` writes remain server-side; route validation repeats the ten-row/two-loading database limits and removes superseded objects.

Mobile calls the lightweight public `/api/racebook-sponsors?raceId=...` route in parallel with the main RaceBook data. Public access requires the same live race/event/RaceBook flags; an authenticated active organizer can preview. The response exposes only active placement DTOs and counted redirect URLs. The redirect validates edition membership, rate-limits counting with a hashed network identifier, attempts the atomic increment, and always preserves navigation to a valid active sponsor target.

### Billing and Entitlements

Stripe routes live under `apps/web/app/api/stripe`:

- `checkout/route.ts`: creates subscription checkout sessions.
- `portal/route.ts`: creates billing portal sessions.
- `price/route.ts`: fetches the configured Stripe price and caches it for 5 minutes.
- `webhook/route.ts`: verifies Stripe signatures and updates `subscriptions`.
- `organizer/publication-checkout/route.ts`: creates one-time 99/199/349 € HT edition checkouts, plus 100/250/150 € HT upgrades, selected entirely by the server.

The Stripe webhook also updates `organizer_edition_payments` for immediate/deferred payment outcomes, expiry, refunds, disputes, and the generated Invoice reference, then recalculates the separate edition entitlement. Organizer success redirects poll the normal event detail until the webhook-confirmed tier appears. The same ledger stores admin-recorded EUR bank transfers. Organizer event/bootstrap DTOs expose only a sanitized purchase summary; the Factures action loads event-wide edition history and obtains manual private-Storage or Stripe PDF URLs from membership-checked server routes.

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

- Keep `racebook_preview_is_visible` in both Organizer bootstrap and event-detail format projections. Omitting it makes a durably masked format render as private after an event reload. Masked and private states both persist `is_live = false`; preview selection distinguishes organizer-private access, while the publication RPC atomically restores all public flags.
- Publication-tier existence checks must project a column that exists on the inspected table. `race_event_edition_branding` uses `edition_id` as its primary key; selecting `id` returns a Supabase Data API 400 before Stripe is called.
- Keep the active pack/source context and bank-transfer API errors inside the open admin purchase dialog as well as in page state, otherwise a rejected duplicate or downgrade has no visible feedback behind the modal.
- Keep editable branding content out of the Organizer bootstrap payload. The bootstrap may expose only the derived published/draft status needed by the tile; the membership-gated draft editor still loads only when its module opens, and its publish action remains Signature-gated.
- Do not reopen the section configurator automatically beside the dashboard guide. The guide owns first-arrival presentation; section configuration opens only from its final action or the explicit `Gérer les sections` control.
- Do not proxy a branding logo through JSON/base64. If the dormant control is re-enabled, use the existing multipart upload, validate MIME plus binary signature and size server-side, then store the public URL in the service-only projection.
- Do not return an empty blog collection when `content/blog` cannot be located. The sitemap depends on explicit failure to expose a deployment/file-tracing problem instead of silently dropping every article URL.
- Do not infer article language from accents or tags. French copy without accented characters previously received English bylines and CTAs; use validated frontmatter locale with the French default.
- Keep `/organisateurs` as the indexable French acquisition page. `/organizers` is the authenticated creation workflow and `/race-planner/print/assistance` is a transient print view; both must remain `noindex`.
- Never render stale race content at a former slug. Resolve its stable race id, verify current public visibility, then issue the permanent redirect before loading discovery links.
- Keep every legacy/blog redirect target inside the route-or-canonical integrity test, and never introduce a redirect chain or a target without a real page.
- Do not call `headers()` from the root layout solely to localize `<html lang>`; that opts the complete public surface into dynamic rendering. A future server-correct English document language requires a deliberate multi-root-layout route structure.

- Do not store service-role keys in client code. `getSupabaseServiceConfig` is server-only by usage.
- Keep verified-session readiness independent from the entitlement request. Premium consumers must use `isEntitlementsLoading` when they need to wait for effective rights; authenticated surfaces such as Organizer should not wait for that secondary request.
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
- Keep event website/social link normalization in the shared organizer-details schema so foreground and background saves accept valid domain links without an explicit protocol but still reject arbitrary text and non-HTTP(S) schemes.
- Course discovery and Racebook publication are separate contracts. Web catalog pages continue to use `is_live` / `is_public`; never substitute `racebook_is_live` into the SEO catalog filter.
- Catalog presentation may group formats only by stable `eventId`. Never merge homonymous events or synthesize event identity from display names or locations.
- Keep bib pickup, equipment, and access at event level as the defaults. A format may opt into a complete replacement through the module's `overrideEnabled`; each override participates in the race-scoped autosave plan so navigation cannot discard the checkbox or its fields. Historical access JSON without the flag may still be treated as specific when it contains meaningful format data.
- Preserve the tri-state compatibility of format equipment JSON: `true` is a full replacement, `false` is authoritative inheritance, and only a missing legacy flag may be inferred from old format-specific items or notes.
- Keep the active weather plan on the event-level equipment JSON. Formats may retag items for `cold` / `heat`, but they must not choose a different active plan than the event.
- Keep format access toggles and ravito timing cards aligned with completion/autosave logic; changing one without the others creates broken navigation or misleading scores.
- Keep three-state visibility saves scoped to the switched format. Do not foreground-save an unrelated active draft before moving another format between Masqué, Privé, and Public; the server remains authoritative for entitlement and readiness.
- Do not filter masked formats out of the authorized Organizer workspace. Grey styling and the explicit `Course masquée pour le public` label communicate runner visibility while preserving organizer/admin editing access.
- Keep the organizer request body, server readiness query, stored publication request, and admin queue aligned on the same `race_id`; event-level inference reintroduces cross-edition publication bugs.
- `/courses/[slug]` renders a single `<main>` from `root-chrome.tsx`; the page root must stay a `<div>`, not another `<main>`.
- `GpxRouteMapClient` defaults to non-interactive on the course detail page via `RaceRouteExplorer`; do not remove the "Explorer la carte" activation step, it prevents the map from capturing mobile scroll gestures.
- `AccordionItem` (`apps/web/components/ui/accordion.tsx`) is native `<details>`-based on purpose: content must stay in the server-rendered HTML for SEO, so do not swap it for a client-side conditional-render implementation that hides collapsed panels from the initial markup.
- The Ravitos save plan must PATCH the active race details before PUTting aid stations because start/finish times live in `races.organizer_details.schedule`, not on `race_aid_stations`.
- Relay-point writes must remain on the membership-checked service route. Do not grant organizer clients direct mutations or merge relay points into plan aid stations.
- Keep autosave dirtiness and revisions scoped by event/race, serialize background writes for the same scope, and suppress only success feedback. Errors and `beforeunload` protection must remain visible until the relevant scope is clean.
- Race sidecar and GPX loaders must compare their requested race id with the current active race before applying responses, because navigation no longer waits for prior network work.
- Keep organizer header completion summaries format-scoped. The bootstrap and event detail responses retain lightweight persisted counts for ravitos, SAS and podiums, plus edition service/sponsor/branding status, so selecting another tab or opening a lazy editor is not required to correct a tile.
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
- The manual notification route additionally requires the selected edition's Pro capability; RaceBook UI must offer the 100 € HT upgrade instead of attempting the send.
- Organizer update deletion must stay on the authenticated server route. Do not grant broad client delete access to `race_event_updates`, and do not treat deletion as a recall of already delivered pushes.
- Public plan share pages are unauthenticated by design, but they must display only the bounded snapshot in `plan_share_links`, not live editable plan data.
- Public plan share pages are standalone in `RootChrome` and force light theme variables so a visitor's saved dark preference does not affect crew readability.
- Set `PLAN_SHARE_TOKEN_SECRET` if reusable crew links must survive a service-role key rotation without creating one new stable link on the next re-share.
- Public crew-state updates use the URL token as the secret. Keep the route rate-limited and avoid adding fields that would let a crew viewer edit the private plan.
- Do not include the public crew token or snapshot content in PostHog/Google Analytics events.

- Admin access to the complete Organizer event selector must continue to come from trusted `app_metadata` through `isAdminUser`; never broaden the catalog response for ordinary authenticated users.
- Keep the Organizer bootstrap payload aligned with the existing claims and event-detail read contracts. Do not reintroduce a second authentication or membership lookup after the selected event has been derived from the already-authorized membership set.
- Keep module-specific Organizer reads lazy. Opening the event overview must not download GPX, ravitos, relay points, product data, announcements, or follower totals; late responses must still be scoped to the active race before updating state.
- Keep full sponsor draft reads in the membership-gated lazy model: switching editions must discard the prior edition list, and mobile/public clients must never receive direct `website_url` values or table access. Runner-facing placements remain Signature/effective-module gated; the organizer bootstrap may carry only active-count and aggregate-click summaries for tile status.
- Prefer a freshly loaded sponsor/branding editor summary over the bootstrap projection after a mutation; until then, use the selected edition's bootstrap summary instead of displaying a false empty tile.
- Treat route-local Organizer cache values as immutable snapshots. Invalidate race data after relevant mutations and clear the complete cache at a user-session boundary so organizer-scoped products or draft course data cannot cross accounts.
- Keep the Organizer cache bounds when adding cached sidecars. TTL alone does not cap memory for many event/race selections in a long-lived dashboard session.

## Related Docs

- [Session Management](../04-auth-and-security/session-management.md)
- [Auth Flows](../04-auth-and-security/auth-flows.md)
- [Plan Storage](../03-business-rules/plan-storage.md)
- [GPX Import](../03-business-rules/gpx-import.md)
- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
- [Stripe](../05-integrations/stripe.md)
