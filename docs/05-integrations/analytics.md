---
title: Analytics
scope: integration
last_verified: 2026-09-24
ai_priority: medium
related_files:
  - apps/web/lib/posthog-organizer-analytics.ts
  - apps/web/lib/posthog-organizer-analytics.test.ts
  - apps/web/app/api/organizer/editions/[id]/analytics/route.ts
  - apps/web/app/api/organizer/editions/[id]/analytics/route.test.ts
  - apps/web/app/organizer/_components/dashboard/analytics-panel.tsx
  - apps/web/app/organizer/_components/dashboard/analytics-panel.test.ts
  - apps/web/components/ui/TimeSeriesLineChart.tsx
  - apps/web/app/admin/components/TimeSeriesLineChart.test.ts
  - apps/web/lib/posthog-config.ts
  - apps/web/lib/posthog-browser.ts
  - apps/web/app/posthog-provider.tsx
  - apps/web/app/analytics.tsx
  - apps/web/app/organisateurs/organizer-landing-page.tsx
  - apps/web/app/organisateurs/organizer-landing-page.test.ts
  - apps/web/app/organizers/page.tsx
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/lib/google-analytics.ts
  - apps/web/lib/organizer-acquisition.ts
  - apps/web/app/api/admin/growth/route.ts
  - apps/web/app/api/admin/growth/schema.ts
  - apps/web/app/admin/components/AdminGrowthSection.tsx
  - apps/web/app/admin/components/AdminTrendChart.tsx
  - apps/web/app/admin/_components/AdminUsersTab.tsx
  - apps/web/app/api/admin/users/route.ts
  - apps/web/app/api/admin/users/route.test.ts
  - apps/web/app/admin/_components/admin-types.ts
  - apps/web/lib/product-analytics.ts
  - apps/web/lib/product-analytics.test.ts
  - apps/mobile/lib/posthog.ts
  - apps/mobile/app/_layout.tsx
  - apps/mobile/hooks/useSessionSideEffects.ts
  - apps/mobile/hooks/useProfileScreen.ts
  - apps/mobile/hooks/profileScreenHelpers.ts
  - apps/mobile/hooks/useRevenueCatBilling.ts
  - apps/mobile/components/premium/PremiumUpsellModal.tsx
  - apps/mobile/app/(app)/catalog.tsx
  - apps/mobile/hooks/useGuestAccountPrompt.ts
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/components/racebook/RacebookAccessSection.tsx
  - apps/mobile/components/racebook/RacebookAidStationsSection.tsx
  - apps/mobile/lib/racebookOnboarding.ts
  - apps/web/app/api/racebook-sponsors/[id]/click/route.ts
  - supabase/migrations/20260903095451_add_admin_kpi_aggregates.sql
  - supabase/migrations/20260912172415_decommission_affiliate_engagement_analytics.sql
related_tables:
  - user_favorite_race_events
  - race_event_edition_sponsors
  - race_event_edition_branding
  - organizer_edition_entitlements
---

# Analytics

## Purpose

This document describes analytics integrations used by the web and mobile apps. Do not commit real analytics keys into docs.

## Key Concepts

- PostHog: product analytics on web and mobile.
- Consent gate: web analytics only load after cookie consent.
- Sanitized path: web pageviews remove sensitive query parameters.
- Acquisition context: UTM values and referring domains are stored as bounded properties, never as full referrer URLs.
- Vercel Analytics: web analytics/speed insights loaded after consent.

## Web PostHog

Web configuration lives in:

- `apps/web/lib/posthog-config.ts`
- `apps/web/lib/posthog-browser.ts`
- `apps/web/app/posthog-provider.tsx`

Environment variables:

- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_TOKEN`
- `NEXT_PUBLIC_POSTHOG_HOST`

Default host:

- `https://us.i.posthog.com`

Sensitive query parameters are removed from analytics paths:

- `access_token`
- `code`
- `email`
- `id_token`
- `invite_token`
- `refresh_token`
- `token`

The browser client enables PostHog autocapture and page-leave capture after analytics consent. Manual `$pageview` events add a stable `page_group`, the path without dynamic query data, and acquisition properties. A consented browser session also emits `web session started` once with its landing area and attribution. Attribution distinguishes campaign, organic search, social, referral, and direct traffic; only the referring domain is retained.

Identified Web and mobile users are marked with PostHog's `$internal_or_test_user` person property when their normalized email is `faustinbertrand1990@gmail.com` or their trusted Supabase `app_metadata.role` / `app_metadata.roles` contains `admin`. The PostHog project must keep its internal/test-user exclusion enabled (or exclude the matching cohort) on product dashboards. Because this is a person property, the filter also applies to earlier events already attached to the same identified PostHog person after that person identifies again.

## Web Consent

`apps/web/app/posthog-provider.tsx` and `apps/web/app/analytics.tsx` listen for the cookie consent event and only load analytics when consent allows it.

Vercel analytics are loaded through:

- `@vercel/analytics`
- `@vercel/speed-insights/next`

## Organizer Acquisition

The homepage exposes a direct audience route to the French `/organisateurs` explanation page; ordinary consent-gated pageview tracking measures that navigation without a new custom event. That landing page forwards only `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term` to `/organizers`. CTA clicks emit `organizer_landing_cta_clicked` with the CTA kind, placement, destination, and available attribution. Primary clicks target the organizer creation flow; secondary clicks target the production Google Play listing from the hero, TST demonstration, or final section. The authenticated `/organizer` dashboard is a valid post-auth return path; it may retain one validated event UUID for post-login navigation but never retains arbitrary query values or acquisition parameters, and that UUID is not added to acquisition analytics. Switching among the four TST screenshot tabs, including through the compact viewport-constrained preview, is deliberately not tracked. A successful event creation emits `organizer_event_created` with the same attribution before redirecting to the selected event; renaming its card to `Créer mon événement` changes no event name or payload. Both tracked events use the existing consent-gated `trackGoogleAnalyticsEvent` bridge, so PostHog and Google Analytics receive nothing before analytics consent.

The authenticated organizer dashboard adds a separate commercial funnel: `organizer offer viewed` when the pricing dialog opens with a valid edition context and at least one locally publishable format, `organizer checkout started` only after the server creates a Stripe Checkout URL, and `organizer purchase verified` only after the normal dashboard refresh observes the requested active edition entitlement. These events contain tier and edition-year context, not amounts or payment identifiers; Stripe and `organizer_edition_payments` remain the financial source of truth.

Organizer content analytics use `organizer_event_created` for the initial event, then `organizer race created`, `organizer event updated`, and `organizer race updated` for successful dashboard writes. The creation event includes the edition year and calendar days remaining before its start. Update events expose only technical ids, edition year, calendar `days_until_race`, manual/background save mode, and a comma-separated allowlist of changed field categories. They never send field values, event/race names, contact details, locations, URLs, or announcement copy. Aid-station replacement is counted as the `aid_stations` category. PostHog dashboards must exclude `$internal_or_test_user = true`; newly added update insights remain empty until the updated Web client is deployed and consented organizers save content.

Opening, replaying, stepping through, or closing the Organizer spotlight guide emits no organizer content event. The guide waits for a cookie decision before presentation and suppresses the mobile-app prompt while active; this UI coordination must not be interpreted as analytics consent or as a saved organizer action.

## Web Plan Value Events

`apps/web/lib/product-analytics.ts` centralizes consent-gated Web product events and keeps core plan names aligned with mobile:

- `plan created` and `plan saved` are emitted only after successful server persistence, with source and aggregate plan-shape properties;
- `plan exported` records GPX download or assistance-print initiation, with saved/draft state;
- public crew links emit `plan crew link opened` and `plan crew state updated` with aggregate checkpoint counts and a bounded action. They never include the secret URL token, plan name, or another direct identifier.

Mobile additionally emits `race favorite updated` only after the server returns the persisted favorite set, and `push notification opened` after a notification interaction with a bounded notification kind/action. The optimistic heart animation, stable current ordering, and in-memory quick-filter changes emit no additional analytics event. Guest account gates emit `guest account prompt viewed` with a bounded `race_favorite` or `plan_limit` source, then `guest account conversion started` only when the runner chooses account creation or existing-account sign-in. Notification hrefs, message bodies, and guest-prompt copy are excluded.

## Mobile PostHog

Displaying a catalog format with an unavailable D+ does not emit a synthetic selection or plan-start event: the plan action is disabled until the metric is supplied.

Mobile configuration lives in `apps/mobile/lib/posthog.ts`.

Environment variables:

- `EXPO_PUBLIC_POSTHOG_KEY`
- `EXPO_PUBLIC_POSTHOG_TOKEN`
- `EXPO_PUBLIC_POSTHOG_HOST`

Default host:

- `https://us.i.posthog.com`

The mobile PostHog client:

- disables itself when no key/token exists;
- captures app lifecycle events;
- supports identify, reset, event capture, and screen tracking helpers.
- registers `surface: app` on custom events and screen views;
- groups screens into stable product areas so analysis does not depend on individual route names.

The root layout emits `app session started` once per process with the landing screen group, locale, auth state, Premium state, and update channel. It also emits `deep link opened` for initial and in-app links. Deep-link analytics retain only the scheme, host, and the explicit UTM allowlist; paths and arbitrary query values are not captured.

The mobile Premium funnel uses explicit events instead of treating a store callback as accounting truth:

- `premium paywall viewed` is emitted when the inline Profile offer or a feature-gate modal is actually displayed. `paywall_type` distinguishes `inline` from `modal`, and `placement` distinguishes `profile` from `feature_gate`.
- `premium checkout started` is emitted when the runner presses the upgrade CTA. RevenueCat attempts use `billing_provider: revenuecat`; browser fallbacks use `billing_provider: web_fallback`.
- `premium purchase verified` is emitted only after RevenueCat returns an active Premium entitlement whose product matches the completed transaction. It includes the product/package and transaction identifiers, purchase date, RevenueCat store, entitlement id, period/ownership types, expiration, and `environment: sandbox|production`.
- `premium purchase unverified` records a returned purchase result whose Premium entitlement is inactive or missing. Cancellation, unavailable checkout, and thrown failures use `premium checkout cancelled`, `premium checkout unavailable`, and `premium purchase failed` respectively.

The former `premium purchased` event is legacy data and is no longer emitted. Do not combine it with `premium purchase verified` in revenue reporting. PostHog remains product analytics; RevenueCat/App Store or Stripe remains authoritative for recognized transactions.

`apps/mobile/app/_layout.tsx` retains push registration while `useSessionSideEffects` runs Resend and other session maintenance. Both remain separate from PostHog identify/reset calls.
Route-presentation choices in the same layout, such as hiding the bottom tab bar for required onboarding, must stay separate from analytics identity and screen tracking behavior.
The premium modal's VoiceOver isolation and labeled dismissal controls are presentation-only; they do not emit analytics events or change the Premium funnel.
The normal cold-start destination is the Courses catalog; that routing decision does not change analytics identity initialization.
The Profile debug/admin presentation uses the same pure trusted-role helper: `app_metadata.role` or `app_metadata.roles` only. User-editable `user_metadata` never marks a mobile user as internal/admin.
Profile dirty-state detection and moving runner onboarding shortcuts from personal information to Settings are presentation changes only. They emit no new analytics event; `profile saved` still fires only after a successful persisted profile mutation.

## RaceBook Engagement

The guided RaceBook catalog emits explicit selection events before the RaceBook screen opens, plus an optional search event:

- `racebook onboarding search performed` after an optional deliberate search of at least two characters, with query length and result counts but never the search text;
- `racebook onboarding race selected` when the runner opens an event from either the initial list or filtered results;
- `racebook onboarding racebook selected` when the runner chooses an accessible published format.

The ordered funnel is `onboarding started` filtered to `onboarding_kind = racebook`, `racebook onboarding race selected`, `racebook onboarding racebook selected`, then `racebook opened`. Search is an optional behavior metric and is not a required conversion step. Both selection events expose `selection_method: browse|search`, based on whether a valid search was active. A `$screen` Catalog view is navigation only and must not be interpreted as course selection.

The mobile RaceBook emits `racebook opened` only after an accessible RaceBook has finished loading, the edition sponsor/module/branding bootstrap has resolved, and the loading composition has exited. Every RaceBook engagement event carries the stable `race_id`, optional parent `event_id`, public race/event names, race date, local-calendar `days_before_race`, a bounded proximity window, and whether the screen was opened by the guided tour or standard navigation. This supports per-RaceBook unique-reader trends and same-RaceBook retention without adding an analytics table to Supabase.

The screen also emits `racebook tab viewed`, `racebook refreshed`, `racebook aid station opened`, `racebook access detail opened`, and `racebook action clicked` for Maps, official-site, social, and emergency-call actions. `racebook closed` summarizes foreground-only active duration, visited tab counts, action count, and an engagement flag when the focused screen is left. Force-closing the process may prevent that final summary from being delivered, so opening/retention analysis must use `racebook opened` as its durable base event. Resolved inaccessible routes emit `racebook unavailable viewed` with the requested race id.

Access and ravito UI now delegate interaction callbacks to focused presentational components. The route remains the analytics boundary: those components receive callbacks and must not import PostHog or attach organizer-authored content to events.

The always-visible ravito segment chronology and its distance/elevation connectors are presentation-only. Expanding a station still emits the existing `racebook aid station opened` event only when products or notes make that station expandable; connector visibility adds no new analytics event or property.

Sponsor presentation and clicks are intentionally excluded from these person-level RaceBook engagement events. Sponsor click reporting keeps its separate aggregate redirect counter and must not be joined to runner analytics identities.

The two-line visual truncation of a bib-pickup address is presentation-only: opening the link still emits the existing Maps action with the same bounded context and never sends the full address.

Edition branding is presentation state only. Logo URLs, the temporary logo feature flag, custom color values, and derived accent-surface usage are not attached to identified RaceBook analytics events; existing race/event identifiers remain the comparison dimensions across default and customized editions.

### Organizer-facing RaceBook statistics

`GET /api/organizer/editions/[id]/analytics` is the only application bridge from an organizer session to PostHog. It first verifies the Supabase bearer session, the edition's parent-event membership (trusted admins retain their existing bypass), the effective `racebook_analytics.view` capability, and an optional `raceId` against the edition. The browser never receives a PostHog API key and never calls PostHog directly. The same authorized request also reads an exact Supabase count from `user_favorite_race_events` and adds `summary.favoriteCount`; this KPI is event-scoped, remains unchanged by the optional format or date-range filters, and never exposes follower identities.

The route accepts `range=7d|30d|90d` (30 days by default) and an optional edition-owned `raceId`. It passes one named Endpoint the parent event id, edition id and dates, the complete allowlisted edition format ids, the optional selected format, and bounded UTC reporting dates. Filtering by the edition's format-id allowlist is mandatory because mobile RaceBook events carry `event_id` and `race_id`, but no `edition_id`; filtering on the event alone could mix yearly editions.

The named Endpoint is `organizer-racebook-analytics` by default and must return this stable contract. PostHog SQL Endpoints currently return positional rows alongside a `columns` array; the client also accepts equivalent object rows so the application contract remains stable across both response representations:

- exactly one `kind = summary` row containing non-negative `unique_readers` and `total_opens`, plus nullable `average_active_seconds` and `engagement_rate` (0–1);
- zero or more `kind = daily` rows containing `YYYY-MM-DD` `date`, non-negative `unique_readers`, and non-negative `total_opens`;
- the standard PostHog Endpoint envelope with `results` as positional or object rows and `columns` whenever rows are positional.

The exact HogQL source of truth is `ORGANIZER_RACEBOOK_ANALYTICS_HOGQL` in `apps/web/lib/posthog-organizer-analytics.ts`. The active SQL Endpoint uses that query and eight String variables: `event_id`, `edition_id`, `edition_start_date`, `edition_end_date`, `race_ids_csv`, `race_id`, `date_from`, and `date_to`. The route always sends every variable and uses an empty string for the optional `race_id`. Keep it published under `organizer-racebook-analytics`, active, and at **900 seconds** data freshness. Any query change must start in the checked-in constant, then be republished and validated for both an all-format request and a selected-format request in the Endpoint Playground.

The same query with representative variables substituted as literals was executed read-only against the connected project on 2026-09-15. On 2026-09-16, Endpoint version 1 was then executed with the real Trail Ton Château edition and format allowlist; it returned the expected summary plus seven daily rows. PostHog accepted its `UNION ALL`, array allowlist, optional format filter, UTC date conversion, current-person exclusion, conditional aggregates, duration average, and engagement ratio. PostHog does not support `grouping()` for a rollup discriminator, so preserve the validated `UNION ALL` form.

Unique readers and daily trends use `racebook opened`. Duration and engagement use `racebook closed`, so both are nullable when no completed close summary exists and remain estimates when the app is force-closed. The Endpoint must exclude current persons marked `$internal_or_test_user = true`, constrain `race_id` to the supplied edition allowlist, apply the selected race when non-empty, and constrain event timestamps to the supplied reporting dates. Its data freshness is 900 seconds; the application requests `refresh: cache` and exposes that TTL in the response.

The server uses `POSTHOG_API_KEY` with only `endpoint:read`, or the existing server-only alias `POSTHOG_PERSONAL_API_KEY`, together with `POSTHOG_PROJECT_ID` and the API origin in `POSTHOG_API_HOST`; `POSTHOG_ORGANIZER_ANALYTICS_ENDPOINT` optionally overrides the default endpoint name. `POSTHOG_API_HOST` is the private API application origin such as `https://eu.posthog.com`, not the public ingestion host ending in `.i.posthog.com`. Missing configuration, non-2xx responses, network failures, and malformed rows all become a generic 502 without returning upstream bodies or credentials.

The production-connected PostHog project is id `176628`. Endpoint `organizer-racebook-analytics` was provisioned there on 2026-09-16 as active version 1 with a 900-second freshness target and validated against real edition-scoped events. Vercel already exposes `POSTHOG_PROJECT_ID`, `POSTHOG_API_HOST`, and the server secret under `POSTHOG_PERSONAL_API_KEY`; the application accepts that existing secret name without copying or exposing its value.

## Admin Growth Dashboard

The admin Growth tab is operational and uses Supabase only:

- Supabase is authoritative for accounts, plans, subscriptions, organizer memberships, editions, formats, and RaceBook publication state.
- Web/App product behavior, acquisition, funnels, and retention are analyzed directly in the PostHog product and are not queried by the application.

The Growth dashboard and the Users management tab consume a shared Supabase daily trend series for account creation, mature 24-hour activation cohorts, plan creation, and plan activity. Every user/plan/subscription/activity total excludes accounts whose Auth `raw_app_meta_data.role` or `roles` contains `admin`. `get_admin_growth_metrics` calculates the bounded Europe/Paris reporting range inside Postgres, so the application no longer downloads whole operational tables or depends on the Data API row cap.

The Users table keeps its global email/id/role search and adds column-typed filters for email text, role membership, account-creation date range, and last-sign-in date range. The protected admin route applies every filter to the complete normalized Supabase Auth collection before sorting and 20-row pagination; date upper bounds include the complete selected UTC calendar day. Premium is intentionally not offered as a column filter because grants, trials, and subscriptions are enriched only after the Auth result page has been selected.

Activation uses only identified accounts whose complete 24-hour observation window has elapsed. The eligible denominator is exposed separately from all new accounts. Effective Premium is the distinct union of active subscription rows, active application trials, and active manual grants; the detail separates paid subscriptions, trials, grants, and paid providers so overlapping access sources do not inflate the unique total.

Organizer activity uses non-admin organizers' Auth `last_sign_in_at`, because edition and format `updated_at` timestamps do not identify the actor and can therefore be moved by trusted-admin maintenance. New-organizer and event-creation totals additionally require a self-created membership (`created_by = user_id`); unknown or admin-delegated membership creation is not interpreted as organic acquisition. The follow-up inactivity timestamp uses the non-admin owner’s last sign-in, falling back to membership creation only when no sign-in exists.

RaceBook commercial entitlement KPIs are current stock counts by eligible edition, not selected-period flows:

- active: `organizer_edition_entitlements.status = active` and tier `racebook` or `pro`;
- gifted: active access whose source is `admin` or `legacy_admin`;
- paid: active access whose current source is `stripe`.

Only editions attached to an event with an active non-admin organizer membership are eligible, so admin-only demos and maintenance do not inflate these totals. “RaceBooks published” remains a selected-period format count based on publication approval, not an edition entitlement count. Growth summary projections normalize the selected period's observed pace to 30 days; they are directional run-rate context, not forecasts.

The organizer conversion table is a real event cohort: events self-created during the selected range are followed through edition existence, complete-format existence, and live RaceBook publication. Every row therefore uses the same event grain and cannot exceed its previous step.

Commercial flows come from `organizer_edition_payments`: checkout attempts created in the range, cohort attempts that later received `paid_at`, payments received in the range, gross tax-inclusive revenue, refunds/open-or-lost disputes invalidated in the range, net cash movement, and RaceBook/direct-Pro/upgrade mix. These one-time organizer sales must not be mixed with runner subscription MRR.

Affiliate offers and their outbound redirect route remain available, but the application no longer records popup or affiliate-click engagement. The former admin Engagement tab, its collection endpoint, both Supabase event tables, and `get_admin_affiliate_metrics` were removed together by `20260912172415_decommission_affiliate_engagement_analytics.sql`.

## PostHog KPI Dashboards

The pinned `Pace Yourself — Vue produit (Web + App)` dashboard contains the weekly value North Star, DAU/WAU/MAU, DAU/MAU stickiness, daily D1–D30 retention, onboarding-to-first-plan activation, plan usage, acquisition, and RaceBook outcomes. All 27 standard insights enable PostHog's internal/test-account filter. The custom same-RaceBook recurrence HogQL insight applies the equivalent current-person `$internal_or_test_user` exclusion explicitly. The dedicated onboarding and RaceBook dashboards retain their deeper diagnostic views.

Three ordered 90-day funnels complete the P1 scorecard: verified Premium (`pDeN3ulx`), plan creation through crew-link sharing (`SVhGjmv1`), and organizer offer through active entitlement (`WGkPaanv`). A weekly engagement trend (`etCvzzZk`) compares plan exports, crew-link opens and updates, race favorites, and push opens. Newly instrumented Web, mobile, and organizer events show data only after deployment; saved insights may exist before their first event arrives.

The pinned `Organisateurs — Création & évolution des courses` dashboard (`949037`) is the dedicated 90-day content-operations view. Its nine insights cover weekly event/format creation, unique creators, update volume and active editors, weekly event-vs-format saves, most-edited field categories, time remaining before the race, manual-vs-background saves, activity by edition, and creation-to-first-edit follow-up. Its three pre-ingestion event definitions remain unverified until production traffic arrives. SQL insights explicitly exclude current persons with `$internal_or_test_user = true`; the standard creation trend uses PostHog's equivalent test-account filter.

## RaceBook Sponsor Clicks

Sponsor reporting is deliberately separate from PostHog and Google Analytics. A press opens the server redirect, which rate-limits counting by sponsor plus a transient hashed network identifier and atomically increments only `race_event_edition_sponsors.click_count`. Organizers see this aggregate raw-opening total; it is not a unique-visitor metric. No impression, user id, network hash, or individual click history is persisted.

## Gotchas

- Exposing preview-selected private formats in the runner mobile catalog, then removing masked formats before presentation, is a visibility/read change rather than a new analytics event. Existing course and RaceBook events keep stable event/race ids and must not record membership ids or private visibility state; masked rows must emit no selection or opening event because they have no mobile entry point.
- Never paste real PostHog keys into docs.
- Do not include sensitive URL tokens in analytics paths.
- Keep the PostHog internal/test-user exclusion enabled. The app marks the owner email and trusted Supabase admins; it does not delete their raw events.
- Keep every mobile admin/internal classification on trusted `app_metadata`; never restore the removed `user_metadata.role` fallback in Profile presentation.
- Web analytics are consent-gated; mobile analytics default opt-in is configured in the native PostHog client.
- PostHog covers only consented Web traffic. Do not compare its visitor totals directly with all Supabase accounts as if both sources had equal coverage.
- Do not present the 30-day run rate as a predictive model; short ranges such as today can be volatile.
- Do not divide activation by accounts whose 24-hour observation window is incomplete.
- Keep Users column filters server-authoritative and before pagination. Filtering only the visible 20 rows would produce incorrect totals and inaccessible matches on other pages.
- Keep the organizer publication funnel cohort-based and event-grained; do not divide user, event, and format flow totals as if they were the same population.
- Treat organizer gross/net revenue as tax-inclusive minor currency units converted for display. It is period cash-movement reporting, not recurring revenue.
- `last_sign_in_at` proves a non-admin organizer connection, not a content edit. Exact non-admin edit metrics would require actor-aware audit rows on every organizer mutation.
- Do not expand organizer attribution beyond the explicit UTM allowlist or persist campaign parameters in browser storage.
- Use environment variable names, not values.
- Do not use analytics identity as proof that a user should be synced to marketing contacts; Resend sync must validate the Supabase session separately.
- Do not interpret paywall or checkout events as revenue. For mobile conversion funnels, count only `premium purchase verified` with `environment: production`, then reconcile against RevenueCat/App Store transactions.
- Do not couple onboarding tab-bar visibility to analytics identity; it is a navigation-shell concern only.
- Do not reinterpret sponsor `click_count` as unique people or join it to runner analytics identities.
- Keep the favorite KPI event-scoped and sourced from the current Supabase relationship count. It is a stock total, not a period flow or a format-specific metric.
- Do not send edition logo URLs or arbitrary organizer colors as analytics properties.
- Measure RaceBook recurrence from repeated `racebook opened` events for the same `race_id`; do not treat a visit to a different RaceBook as retention for the first one.
- Do not use `$screen` with `$screen_name = catalog` as a RaceBook onboarding conversion step. Require event selection, format selection, and successful-open events; search is optional because the initial eligible-course list is directly selectable.

## Related Docs

Selecting or masking a private-demo format is configuration, not a runner RaceBook open or publication analytics event.

- [Mobile App](../01-architecture/mobile-app.md)
- [Web App](../01-architecture/web-app.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [Auth Flows](../04-auth-and-security/auth-flows.md)
