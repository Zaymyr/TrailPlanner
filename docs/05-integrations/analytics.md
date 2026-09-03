---
title: Analytics
scope: integration
last_verified: 2026-09-03
ai_priority: medium
related_files:
  - apps/web/lib/posthog-config.ts
  - apps/web/lib/posthog-browser.ts
  - apps/web/app/posthog-provider.tsx
  - apps/web/app/analytics.tsx
  - apps/web/app/organisateurs/organizer-landing-page.tsx
  - apps/web/app/organizers/page.tsx
  - apps/web/lib/google-analytics.ts
  - apps/web/lib/organizer-acquisition.ts
  - apps/web/app/api/admin/growth/route.ts
  - apps/web/app/api/admin/growth/schema.ts
  - apps/web/app/admin/components/AdminGrowthSection.tsx
  - apps/web/app/admin/components/AdminTrendChart.tsx
  - apps/web/app/admin/_components/AdminUsersTab.tsx
  - apps/web/app/api/admin/analytics/route.ts
  - apps/web/app/api/admin/analytics/route.test.ts
  - apps/web/app/admin/_components/AdminAnalyticsTab.tsx
  - apps/web/app/admin/_components/admin-types.ts
  - apps/web/lib/product-analytics.ts
  - apps/web/lib/product-analytics.test.ts
  - apps/mobile/lib/posthog.ts
  - apps/mobile/app/_layout.tsx
  - apps/mobile/hooks/useProfileScreen.ts
  - apps/mobile/hooks/useRevenueCatBilling.ts
  - apps/mobile/components/premium/PremiumUpsellModal.tsx
  - apps/mobile/app/(app)/catalog.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/lib/racebookOnboarding.ts
  - apps/web/app/api/racebook-sponsors/[id]/click/route.ts
  - supabase/migrations/20260903095451_add_admin_kpi_aggregates.sql
related_tables:
  - race_event_edition_sponsors
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

## Web Consent

`apps/web/app/posthog-provider.tsx` and `apps/web/app/analytics.tsx` listen for the cookie consent event and only load analytics when consent allows it.

Vercel analytics are loaded through:

- `@vercel/analytics`
- `@vercel/speed-insights/next`

## Organizer Acquisition

The French `/organisateurs` landing page forwards only `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term` to `/organizers`. CTA clicks emit `organizer_landing_cta_clicked` with the CTA kind, placement, destination, and available attribution. Switching among the four TST screenshot tabs, including through the compact viewport-constrained preview, is deliberately not tracked. A successful event creation emits `organizer_event_created` with the same attribution before redirecting to the selected event; the creation page no longer gathers an import URL or starts the admin-only import flow. Both tracked events use the existing consent-gated `trackGoogleAnalyticsEvent` bridge, so PostHog and Google Analytics receive nothing before analytics consent.

The authenticated organizer dashboard adds a separate commercial funnel: `organizer offer viewed` when the pricing dialog opens with a valid edition context, `organizer checkout started` only after the server creates a Stripe Checkout URL, and `organizer purchase verified` only after the normal dashboard refresh observes the requested active edition entitlement. These events contain tier and edition-year context, not amounts or payment identifiers; Stripe and `organizer_edition_payments` remain the financial source of truth.

## Web Plan Value Events

`apps/web/lib/product-analytics.ts` centralizes consent-gated Web product events and keeps core plan names aligned with mobile:

- `plan created` and `plan saved` are emitted only after successful server persistence, with source and aggregate plan-shape properties;
- `plan exported` records GPX download or assistance-print initiation, with saved/draft state;
- public crew links emit `plan crew link opened` and `plan crew state updated` with aggregate checkpoint counts and a bounded action. They never include the secret URL token, plan name, or another direct identifier.

Mobile additionally emits `race favorite updated` only after the server returns the persisted favorite set, and `push notification opened` after a notification interaction with a bounded notification kind/action. Notification hrefs and message bodies are excluded.

## Mobile PostHog

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

`apps/mobile/app/_layout.tsx` is also the home for other session side effects such as push registration and Resend contact sync. Those side effects should stay separate from PostHog identify/reset calls.
Route-presentation choices in the same layout, such as hiding the bottom tab bar for required onboarding, must stay separate from analytics identity and screen tracking behavior.
The normal cold-start destination is the Courses catalog; that routing decision does not change analytics identity initialization.

## RaceBook Engagement

The guided RaceBook catalog emits explicit selection events before the RaceBook screen opens, plus an optional search event:

- `racebook onboarding search performed` after an optional deliberate search of at least two characters, with query length and result counts but never the search text;
- `racebook onboarding race selected` when the runner opens an event from either the initial list or filtered results;
- `racebook onboarding racebook selected` when the runner chooses an accessible published format.

The ordered funnel is `onboarding started` filtered to `onboarding_kind = racebook`, `racebook onboarding race selected`, `racebook onboarding racebook selected`, then `racebook opened`. Search is an optional behavior metric and is not a required conversion step. Both selection events expose `selection_method: browse|search`, based on whether a valid search was active. A `$screen` Catalog view is navigation only and must not be interpreted as course selection.

The mobile RaceBook emits `racebook opened` only after an accessible RaceBook has finished loading. Every RaceBook engagement event carries the stable `race_id`, optional parent `event_id`, public race/event names, race date, local-calendar `days_before_race`, a bounded proximity window, and whether the screen was opened by the guided tour or standard navigation. This supports per-RaceBook unique-reader trends and same-RaceBook retention without adding an analytics table to Supabase.

The screen also emits `racebook tab viewed`, `racebook refreshed`, `racebook aid station opened`, `racebook access detail opened`, and `racebook action clicked` for Maps, official-site, social, and emergency-call actions. `racebook closed` summarizes foreground-only active duration, visited tab counts, action count, and an engagement flag when the focused screen is left. Force-closing the process may prevent that final summary from being delivered, so opening/retention analysis must use `racebook opened` as its durable base event. Resolved inaccessible routes emit `racebook unavailable viewed` with the requested race id.

Sponsor presentation and clicks are intentionally excluded from these person-level RaceBook engagement events. Sponsor click reporting keeps its separate aggregate redirect counter and must not be joined to runner analytics identities.

## Admin Growth Dashboard

The admin Growth tab is operational and uses Supabase only:

- Supabase is authoritative for accounts, plans, subscriptions, organizer memberships, editions, formats, and RaceBook publication state.
- Web/App product behavior, acquisition, funnels, and retention are analyzed directly in the PostHog product and are not queried by the application.

The Growth dashboard and the Users management tab consume a shared Supabase daily trend series for account creation, mature 24-hour activation cohorts, plan creation, and plan activity. Every user/plan/subscription/activity total excludes accounts whose Auth `raw_app_meta_data.role` or `roles` contains `admin`. `get_admin_growth_metrics` calculates the bounded Europe/Paris reporting range inside Postgres, so the application no longer downloads whole operational tables or depends on the Data API row cap.

Activation uses only identified accounts whose complete 24-hour observation window has elapsed. The eligible denominator is exposed separately from all new accounts. Effective Premium is the distinct union of active subscription rows, active application trials, and active manual grants; the detail separates paid subscriptions, trials, grants, and paid providers so overlapping access sources do not inflate the unique total.

Organizer activity uses non-admin organizers' Auth `last_sign_in_at`, because edition and format `updated_at` timestamps do not identify the actor and can therefore be moved by trusted-admin maintenance. New-organizer and event-creation totals additionally require a self-created membership (`created_by = user_id`); unknown or admin-delegated membership creation is not interpreted as organic acquisition. The follow-up inactivity timestamp uses the non-admin owner’s last sign-in, falling back to membership creation only when no sign-in exists.

RaceBook commercial entitlement KPIs are current stock counts by eligible edition, not selected-period flows:

- active: `organizer_edition_entitlements.status = active` and tier `racebook` or `pro`;
- gifted: active access whose source is `admin` or `legacy_admin`;
- paid: active access whose current source is `stripe`.

Only editions attached to an event with an active non-admin organizer membership are eligible, so admin-only demos and maintenance do not inflate these totals. “RaceBooks published” remains a selected-period format count based on publication approval, not an edition entitlement count. Growth summary projections normalize the selected period's observed pace to 30 days; they are directional run-rate context, not forecasts.

The organizer conversion table is a real event cohort: events self-created during the selected range are followed through edition existence, complete-format existence, and live RaceBook publication. Every row therefore uses the same event grain and cannot exceed its previous step.

Commercial flows come from `organizer_edition_payments`: checkout attempts created in the range, cohort attempts that later received `paid_at`, payments received in the range, gross tax-inclusive revenue, refunds/open-or-lost disputes invalidated in the range, net cash movement, and RaceBook/direct-Pro/upgrade mix. These one-time organizer sales must not be mixed with runner subscription MRR.

The affiliate admin tab calls `get_admin_affiliate_metrics` for a bounded Europe/Paris range. Totals and per-product CTR cover the whole range; only the recent-event audit list is capped at 100 rows. It also exposes distinct popup and click sessions. Missing or deleted product rows do not remove their aggregate events.

## PostHog KPI Dashboards

The pinned `Pace Yourself — Vue produit (Web + App)` dashboard contains the weekly value North Star, DAU/WAU/MAU, DAU/MAU stickiness, daily D1–D30 retention, onboarding-to-first-plan activation, plan usage, acquisition, and RaceBook outcomes. The dedicated onboarding and RaceBook dashboards retain their deeper diagnostic views.

Three ordered 90-day funnels complete the P1 scorecard: verified Premium (`pDeN3ulx`), plan creation through crew-link sharing (`SVhGjmv1`), and organizer offer through active entitlement (`WGkPaanv`). A weekly engagement trend (`etCvzzZk`) compares plan exports, crew-link opens and updates, race favorites, and push opens. Newly instrumented Web, mobile, and organizer events show data only after deployment; saved insights may exist before their first event arrives.

## RaceBook Sponsor Clicks

Sponsor reporting is deliberately separate from PostHog and Google Analytics. A press opens the server redirect, which rate-limits counting by sponsor plus a transient hashed network identifier and atomically increments only `race_event_edition_sponsors.click_count`. Organizers see this aggregate raw-opening total; it is not a unique-visitor metric. No impression, user id, network hash, or individual click history is persisted.

## Gotchas

- Never paste real PostHog keys into docs.
- Do not include sensitive URL tokens in analytics paths.
- Web analytics are consent-gated; mobile analytics default opt-in is configured in the native PostHog client.
- PostHog covers only consented Web traffic. Do not compare its visitor totals directly with all Supabase accounts as if both sources had equal coverage.
- Do not present the 30-day run rate as a predictive model; short ranges such as today can be volatile.
- Do not divide activation by accounts whose 24-hour observation window is incomplete.
- Keep the organizer publication funnel cohort-based and event-grained; do not divide user, event, and format flow totals as if they were the same population.
- Treat organizer gross/net revenue as tax-inclusive minor currency units converted for display. It is period cash-movement reporting, not recurring revenue.
- Affiliate totals cover the selected range, while `recentEvents` remains a capped audit sample; do not recompute totals from that list.
- `last_sign_in_at` proves a non-admin organizer connection, not a content edit. Exact non-admin edit metrics would require actor-aware audit rows on every organizer mutation.
- Do not expand organizer attribution beyond the explicit UTM allowlist or persist campaign parameters in browser storage.
- Use environment variable names, not values.
- Do not use analytics identity as proof that a user should be synced to marketing contacts; Resend sync must validate the Supabase session separately.
- Do not interpret paywall or checkout events as revenue. For mobile conversion funnels, count only `premium purchase verified` with `environment: production`, then reconcile against RevenueCat/App Store transactions.
- Do not couple onboarding tab-bar visibility to analytics identity; it is a navigation-shell concern only.
- Do not reinterpret sponsor `click_count` as unique people or join it to runner analytics identities.
- Measure RaceBook recurrence from repeated `racebook opened` events for the same `race_id`; do not treat a visit to a different RaceBook as retention for the first one.
- Do not use `$screen` with `$screen_name = catalog` as a RaceBook onboarding conversion step. Require event selection, format selection, and successful-open events; search is optional because the initial eligible-course list is directly selectable.

## Related Docs

- [Mobile App](../01-architecture/mobile-app.md)
- [Web App](../01-architecture/web-app.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [Auth Flows](../04-auth-and-security/auth-flows.md)
