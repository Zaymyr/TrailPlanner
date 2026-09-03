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
  - apps/mobile/lib/posthog.ts
  - apps/mobile/app/_layout.tsx
  - apps/mobile/hooks/useProfileScreen.ts
  - apps/mobile/hooks/useRevenueCatBilling.ts
  - apps/mobile/components/premium/PremiumUpsellModal.tsx
  - apps/mobile/app/(app)/catalog.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/lib/racebookOnboarding.ts
  - apps/web/app/api/racebook-sponsors/[id]/click/route.ts
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

The guided RaceBook catalog emits three explicit funnel events before the RaceBook screen opens:

- `racebook onboarding search performed` after a deliberate search of at least two characters, with query length and result counts but never the search text;
- `racebook onboarding race selected` when the runner opens one matching event;
- `racebook onboarding racebook selected` when the runner chooses an accessible published format.

Use these events between `onboarding started` filtered to `onboarding_kind = racebook` and `racebook opened`. A `$screen` Catalog view is navigation only and must not be interpreted as course selection.

The mobile RaceBook emits `racebook opened` only after an accessible RaceBook has finished loading. Every RaceBook engagement event carries the stable `race_id`, optional parent `event_id`, public race/event names, race date, local-calendar `days_before_race`, a bounded proximity window, and whether the screen was opened by the guided tour or standard navigation. This supports per-RaceBook unique-reader trends and same-RaceBook retention without adding an analytics table to Supabase.

The screen also emits `racebook tab viewed`, `racebook refreshed`, `racebook aid station opened`, `racebook access detail opened`, and `racebook action clicked` for Maps, official-site, social, and emergency-call actions. `racebook closed` summarizes foreground-only active duration, visited tab counts, action count, and an engagement flag when the focused screen is left. Force-closing the process may prevent that final summary from being delivered, so opening/retention analysis must use `racebook opened` as its durable base event. Resolved inaccessible routes emit `racebook unavailable viewed` with the requested race id.

Sponsor presentation and clicks are intentionally excluded from these person-level RaceBook engagement events. Sponsor click reporting keeps its separate aggregate redirect counter and must not be joined to runner analytics identities.

## Admin Growth Dashboard

The admin Growth tab is operational and uses Supabase only:

- Supabase is authoritative for accounts, plans, subscriptions, organizer memberships, editions, formats, and RaceBook publication state.
- Web/App product behavior, acquisition, funnels, and retention are analyzed directly in the PostHog product and are not queried by the application.

The Growth dashboard and the Users management tab consume a shared Supabase daily trend series for account creation, 24-hour activation, plan creation, and plan activity. Every user/plan/subscription/activity total excludes accounts whose Auth `raw_app_meta_data.role` or `roles` contains `admin`.

Organizer activity uses non-admin organizers' Auth `last_sign_in_at`, because edition and format `updated_at` timestamps do not identify the actor and can therefore be moved by trusted-admin maintenance. New-organizer and event-creation totals additionally require a self-created membership (`created_by = user_id`); unknown or admin-delegated membership creation is not interpreted as organic acquisition. The follow-up inactivity timestamp uses the non-admin owner’s last sign-in, falling back to membership creation only when no sign-in exists.

RaceBook commercial KPIs are current stock counts by eligible edition, not selected-period flows:

- active: `organizer_edition_entitlements.status = active` and tier `racebook` or `pro`;
- gifted: active access whose source is `admin` or `legacy_admin`;
- paid: active access whose current source is `stripe`.

Only editions attached to an event with an active non-admin organizer membership are eligible, so admin-only demos and maintenance do not inflate these totals. “RaceBooks published” remains a selected-period format count based on publication approval, not an edition entitlement count. Growth summary projections normalize the selected period's observed pace to 30 days; they are directional run-rate context, not forecasts.

## RaceBook Sponsor Clicks

Sponsor reporting is deliberately separate from PostHog and Google Analytics. A press opens the server redirect, which rate-limits counting by sponsor plus a transient hashed network identifier and atomically increments only `race_event_edition_sponsors.click_count`. Organizers see this aggregate raw-opening total; it is not a unique-visitor metric. No impression, user id, network hash, or individual click history is persisted.

## Gotchas

- Never paste real PostHog keys into docs.
- Do not include sensitive URL tokens in analytics paths.
- Web analytics are consent-gated; mobile analytics default opt-in is configured in the native PostHog client.
- PostHog covers only consented Web traffic. Do not compare its visitor totals directly with all Supabase accounts as if both sources had equal coverage.
- Do not present the 30-day run rate as a predictive model; short ranges such as today can be volatile.
- `last_sign_in_at` proves a non-admin organizer connection, not a content edit. Exact non-admin edit metrics would require actor-aware audit rows on every organizer mutation.
- Do not expand organizer attribution beyond the explicit UTM allowlist or persist campaign parameters in browser storage.
- Use environment variable names, not values.
- Do not use analytics identity as proof that a user should be synced to marketing contacts; Resend sync must validate the Supabase session separately.
- Do not interpret paywall or checkout events as revenue. For mobile conversion funnels, count only `premium purchase verified` with `environment: production`, then reconcile against RevenueCat/App Store transactions.
- Do not couple onboarding tab-bar visibility to analytics identity; it is a navigation-shell concern only.
- Do not reinterpret sponsor `click_count` as unique people or join it to runner analytics identities.
- Measure RaceBook recurrence from repeated `racebook opened` events for the same `race_id`; do not treat a visit to a different RaceBook as retention for the first one.
- Do not use `$screen` with `$screen_name = catalog` as a RaceBook onboarding conversion step. Require the explicit search, event selection, format selection, and successful-open events.

## Related Docs

- [Mobile App](../01-architecture/mobile-app.md)
- [Web App](../01-architecture/web-app.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [Auth Flows](../04-auth-and-security/auth-flows.md)
