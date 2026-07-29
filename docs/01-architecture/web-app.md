---
title: Web App Architecture
scope: architecture
last_verified: 2026-07-29
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
  - apps/web/app/organizer/_components/dashboard/runner-preview-dialog.tsx
  - apps/web/app/organizer/_components/completion.ts
  - apps/web/app/organizer/_components/completion.test.ts
  - apps/web/lib/organizer-dashboard-details.ts
  - apps/web/app/admin/_components/AdminOrganizerClaimsTab.tsx
  - apps/web/app/api/organizer/claims/route.ts
  - apps/web/app/api/organizer/claims/route.test.ts
  - apps/web/app/api/organizer/edition-requests/route.ts
  - apps/web/app/api/organizer/edition-requests/route.test.ts
  - apps/web/app/api/organizer/publication-requests/route.ts
  - apps/web/app/api/organizer/publication-requests/route.test.ts
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
  - race_event_claims
  - race_event_organizers
  - race_event_publication_requests
  - race_event_updates
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

User-created private races live in `apps/web/app/api/races/route.ts`. They are inserted with `is_public: false` and `created_by` set to the authenticated user.

### Organizer Portal

The organizer header also exposes `Importer depuis un site web`. That flow posts to `/api/organizer/events/[id]/website-import`, reuses the existing UTMB / Trace de Trail import adapters when possible, falls back to a generic HTML + JSON-LD extraction otherwise, and stays review-first: no import write happens until the organizer validates the recap. For a generic site, the organizer provides one general event URL plus zero or more explicit format URLs. The selected organizer event remains the only import target; confirmation may enrich `race_events`, update existing `races`, or create new draft `races` under that same `event_id`, but it must never create another event row or publish anything automatically. Historical drafts are importable even after the normal edition edit window has elapsed.

The post-analysis recap uses a viewport-bounded flex dialog: its header and validation actions stay fixed while the center review panel owns vertical scrolling. The flex display is explicitly prioritized because the shared `cn` helper concatenates utility classes and does not resolve a route-level `flex` against the dialog primitive's default `grid` class.

Each detected format carries a server-computed assessment. The review keeps only formats scored at least `70/100`, and automatically ignores lower-scored candidates so product, ravito, or incidental kilometer detections do not distract the organizer or become import actions. The compact card exposes the score; its expandable detail shows only found values and links to their sources, without repeating score breakdowns or missing-field tiles. The score combines weighted field coverage (65%) and source reliability (35%); required identity, date, distance, and D+ fields weigh twice as much as optional enrichment. Parsed GPX measurements and known provider adapters are high-confidence, dedicated format/regulation sections outrank loose page mentions, and the browser only renders this assessment rather than recomputing it. Before apply, the event recap also exposes an editable date input initialized from the detected date or the current event form date. That explicit ISO-date override is sent separately from the immutable preview payload and is applied server-side after the original preview hash and membership checks pass.

For non-provider sites, the general URL is read only for event-level facts and common logistics (mandatory equipment, departure, shuttles, and parking). The importer does not crawl linked sibling pages automatically. Each explicit format URL is fetched independently, with an eight-second timeout and capped HTML size; its extraction combines JSON-LD, `h1`-`h6` sections, and named regulation prose, filters kilometer mentions from ravitos/barriers/ages/results, then merges complementary findings from the supplied format pages while warning about older editions. Display names remove generic heading prefixes and trailing distance/D+ metadata (for example `Course : La Grande Traversée — 20 km — 1000 D+` becomes `La Grande Traversée`); when duplicate names appear at the same parsed distance, the first page-level name is retained because later labels often identify a ravito. When no distinctive name remains, the distance becomes the safe fallback name. Parsed GPX elevation always overrides HTML D+/D- values, and same-distance detections within 0.2 km are consolidated as one format. The consolidated format unions complementary ravitos only between equal-confidence sources, hydrates one reliable GPX, recalculates its final assessment, and is returned ahead of lower-scoring formats. Named formats replace anonymous same-distance duplicates.

GPX detection accepts both explicit `.gpx` URLs and anchors whose visible label identifies a GPX download, allowing opaque provider paths such as Odoo `/web/content/...`. A distinct GPX can be fetched and parsed for every detected format; it may fill missing distance, D+/D-, and waypoint ravitos. The importer never guesses absent elevation data, so incomplete formats remain reviewable but cannot be created until required fields are supplied.

The v1 organizer portal is web-only:

- `/organizers` creates a new non-live event through `POST /api/organizer/events` and immediately creates its active owner membership. It does not claim existing catalog events. With an official URL, the page redirects to `/organizer` with the new event selected and automatically opens its website-import analysis. The `/organizer` server page normalizes `eventId` and `importUrl` from its `searchParams` prop before passing them to the client dashboard, which keeps the route compatible with static generation without a client-side search-param bailout.
- `/organizer` lets active event members freely maintain draft events, formats, and yearly editions. `Nouvelle édition` directly clones the selected source year as draft formats through the compatibility `/api/organizer/edition-requests` URL; it no longer writes the retired edition-review table. Event and format liveness is read-only in this dashboard. `Demander la publication` creates an event-level `race_event_publication_requests` row after readiness checks.
- The organizer dashboard now uses a route-local address autocomplete field for event location, format location, bib pickup, and start/finish access addresses. It calls `/api/location-search`, keeps the existing text columns as the publishable source strings, and stores structured geocoded metadata alongside them in `organizer_details` so the runner preview can expose GPS coordinates and Google Maps links.
- The organizer creation screen and dashboard keep concise, consistently accented French copy across `/organizers` and `/organizer`.
- The main header always shows "Mes courses" / "My races". It opens `/organizers` to let a new organizer create their first event, then opens `/organizer` after `/api/organizer/claims` reports at least one active membership.
- `apps/web/lib/organizer.ts` centralizes bearer-token verification, admin checks, service headers, and event-membership checks.
- `/api/organizer/*` routes verify the current Supabase user and then use the service role for authorized mutations.
- `/api/race-favorites` is the authenticated runner bridge for favoriting `race_events`, and `/api/race-events/[id]/updates` is the runner/mobile read route for the latest published organizer announcements on live events.
- `/api/admin/organizer-claims` keeps legacy access-claim review and membership revocation. `/api/admin/event-publication-requests` owns publication approval/rejection; approval invokes the service-role-only database review function so event, complete formats, and request status change atomically.

Organizer edits are draft-capable source edits for `race_events`, `races`, `race_aid_stations`, and `race_aid_station_products`. Event/race routes persist nullable organizer JSONB, geocoded metadata, images, equipment, access, schedules, GPX-derived stats, ravitos, and products behind active event membership checks. The dashboard shows completion independently from publication and displays read-only live/brouillon badges. Navigation attempts autosave before changing scope. Organizer routes never mutate event or format liveness directly: `/api/organizer/publication-requests` validates event name/location/start/end dates plus at least one complete format, and `/api/admin/event-publication-requests` performs the atomic approval. Runner preview continues to hide drafts. Existing saved plans remain snapshots, while official ravito products may be refreshed for plans linked to a source race.

The same approved-only dashboard now exposes a manual `Notifier les coureurs` modal. Sending from that modal creates one `race_event_updates` row, then uses `apps/web/lib/push.ts` to notify only the users who favorited that event. The push payload deep-links runners back to `/(app)/catalog?eventId=<eventId>`, and delivery is logged in `push_notification_events` as `notification_kind = 'organizer-race-update'`.

The organizer write surface remains edition-aware for selection and grouping, but no longer becomes read-only based on `race_date`. Active event membership is the mutation authorization boundary for past and future editions.

For a brand-new organizer format, the add-format form may also hold a pending image and GPX file before submit. `OrganizerDashboard.tsx` parses the selected GPX in-browser to prefill distance, D+, and D- immediately, and it requires a format race date before calling the create route. The format editor now keeps race information in a tighter left grid, uses a right-side file rail for GPX-first then image upload, places the elevation profile directly under the left-side data block so the chart can use that full column width, and keeps the interactive OpenStreetMap/Leaflet route map below as the main full-width visual focus. Preview headers should stay concise and avoid repeating the same distance/D+/D- values everywhere when the form already shows them. After the create route returns the new `races.id`, the dashboard reuses the existing organizer image and GPX server routes to upload those files rather than writing to Storage directly from the browser.

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
- Keep organizer location text fields and their sibling geocoded JSON objects in sync. Publication checks still read the text columns/strings, while the preview-only GPS/Google affordances come from `organizer_details`.
- `race_events` is used by API routes, but this repo only shows a migration altering it, not creating it. See [../02-database/tables/race-events.md](../02-database/tables/race-events.md).
- Organizer event creation inserts a non-live `race_events` row and its owner `race_event_organizers` membership through a service route; keep that path server-side and do not expose service-role writes to client code.
- Website import matches update targets inside the validated event year. When that yearly edition is absent, it creates a draft race dated in the event year and reuses a matching series `edition_group_id` from another year instead of updating the old row or creating a duplicate series.
- Keep `/organizer` compatible with production prerendering. Bootstrap query values should enter through the server page props; using `useSearchParams` directly in `OrganizerDashboard` requires a Suspense boundary and otherwise fails `next build`.
- Keep public catalog creation conservative by default: imported/admin-created events and races should start as non-live until someone publishes them deliberately.
- Organizer JSONB details are server-route managed progressive metadata. Keep public/mobile reads on explicit column lists so these draft details are not exposed by broad selects.
- Keep bib pickup shared at event level in the current organizer UI. Equipment is the exception: the dashboard mirrors shared items into every race list so a course can later drop one and shrink the event-level common subset.
- Keep the active weather plan on the event-level equipment JSON. Formats may retag items for `cold` / `heat`, but they must not choose a different active plan than the event.
- Keep format access toggles and ravito timing cards aligned with completion/autosave logic; changing one without the others creates broken navigation or misleading scores.
- Keep organizer ravito cumulative D+ / D- GPX-driven while the current dashboard uses km-based interpolation from the preview trace; letting organizers override those fields manually would desynchronize the saved station metrics from the uploaded course.
- Keep a small UTF-8 regression test near organizer dashboard copy when editing French labels in route-local components; user-facing mojibake on ravito cards should be caught in CI, not by manual QA.
- Organizer-created products are non-live rows attached to source ravitos; do not expose them through public client env or the global catalog API.
- Organizer ravito product refresh is a read-time overlay on `/api/plans`; if the service-role refresh fails, return the stored `organizerAidStationProducts` snapshot instead of blocking plan load.
- Organizer GPX previews are recalculated from the private source GPX; do not add a `races.elevation_profile` column for this dashboard-only curve.
- `react-leaflet` v5 expects React 19 and crashes this app's React 18 runtime during GPX map mount. Keep the organizer map on the React 18-compatible `react-leaflet` 4.x line until the web app itself upgrades React.
- Organizer event image upload accepts PNG only in v1; the client must call the server route instead of writing to Storage directly.
- Keep organizer dashboard French labels UTF-8 clean end-to-end, especially in `event-format-editors.tsx`; mojibake such as `Ã©` is a real regression on the event tab because those strings are rendered directly.
- Do not auto-send runner notifications on organizer save or publish. The manual event-update route is the only intended push trigger for this v1.
- Public plan share pages are unauthenticated by design, but they must display only the bounded snapshot in `plan_share_links`, not live editable plan data.
- Public plan share pages are standalone in `RootChrome` and force light theme variables so a visitor's saved dark preference does not affect crew readability.
- Set `PLAN_SHARE_TOKEN_SECRET` if reusable crew links must survive a service-role key rotation without creating one new stable link on the next re-share.
- Public crew-state updates use the URL token as the secret. Keep the route rate-limited and avoid adding fields that would let a crew viewer edit the private plan.

## Related Docs

- [Session Management](../04-auth-and-security/session-management.md)
- [Auth Flows](../04-auth-and-security/auth-flows.md)
- [Plan Storage](../03-business-rules/plan-storage.md)
- [GPX Import](../03-business-rules/gpx-import.md)
- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
- [Stripe](../05-integrations/stripe.md)
