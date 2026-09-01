---
title: Analytics
scope: integration
last_verified: 2026-08-31
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
  - apps/web/lib/posthog-query.ts
  - apps/web/app/api/admin/growth/route.ts
  - apps/web/app/api/admin/growth/schema.ts
  - apps/web/app/admin/components/AdminGrowthSection.tsx
  - apps/web/app/admin/components/AdminTrendChart.tsx
  - apps/web/app/admin/_components/AdminUsersTab.tsx
  - apps/mobile/lib/posthog.ts
  - apps/mobile/app/_layout.tsx
  - apps/web/app/api/racebook-sponsors/[id]/click/route.ts
related_tables:
  - race_event_edition_sponsors
---

# Analytics

## Purpose

This document describes analytics integrations used by the web and mobile apps. Do not commit real analytics keys into docs.

## Key Concepts

- PostHog: product analytics on web and mobile.
- Consent gate: web analytics only load after cookie consent.
- Sanitized path: web pageviews remove sensitive query parameters.
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

`apps/mobile/app/_layout.tsx` is also the home for other session side effects such as push registration and Resend contact sync. Those side effects should stay separate from PostHog identify/reset calls.
Route-presentation choices in the same layout, such as hiding the bottom tab bar for required onboarding, must stay separate from analytics identity and screen tracking behavior.
The normal cold-start destination is the Courses catalog; that routing decision does not change analytics identity initialization.

## Admin Growth Dashboard

The admin Growth tab separates Web acquisition, App activation/retention, and Organizer acquisition/publication. `apps/web/app/api/admin/growth/route.ts` combines two sources without treating either one as interchangeable:

- Supabase is authoritative for accounts, plans, subscriptions, organizer memberships, editions, formats, and RaceBook publication state.
- PostHog supplies consented Web visitors/funnels, mobile screen activity, App retention cohorts, and organizer landing/dashboard visitors.

The server-only PostHog reader in `apps/web/lib/posthog-query.ts` calls the project query API with:

- `POSTHOG_PERSONAL_API_KEY`
- `POSTHOG_PROJECT_ID`
- optional `POSTHOG_API_HOST`; the public ingestion host is converted to the matching regional API host when this is absent.

The personal key needs PostHog's `query:read` scope for the HogQL query endpoint.

These read credentials must never use a `NEXT_PUBLIC_` prefix. If either required value is absent or the query fails, the endpoint still returns the Supabase metrics and marks PostHog-derived values unavailable instead of substituting estimates. App J+1/J+7/J+30 retention uses first `$screen` cohorts and an exact one-day return window. The organizer follow-up list is a Supabase operational proxy based on membership plus edition/format modification timestamps; it is not presented as a browser-session measurement.

The Growth dashboard and the Users management tab also consume a shared daily trend series. Supabase provides daily account creation, 24-hour activation, plan creation, and plan activity; PostHog adds daily unique Web visitors and active App users when server read credentials are available. Missing PostHog access leaves those series unavailable while preserving the Supabase curves. Growth summary projections normalize the selected period's observed pace to 30 days; they are directional run-rate context, not forecasts.

## RaceBook Sponsor Clicks

Sponsor reporting is deliberately separate from PostHog and Google Analytics. A press opens the server redirect, which rate-limits counting by sponsor plus a transient hashed network identifier and atomically increments only `race_event_edition_sponsors.click_count`. Organizers see this aggregate raw-opening total; it is not a unique-visitor metric. No impression, user id, network hash, or individual click history is persisted.

## Gotchas

- Never paste real PostHog keys into docs.
- Do not include sensitive URL tokens in analytics paths.
- Web analytics are consent-gated; mobile analytics default opt-in is configured in the native PostHog client.
- Admin Web funnels therefore cover only consented traffic. Do not compare their visitor totals directly with all Supabase accounts as if both sources had equal coverage.
- Keep PostHog personal API keys server-only. A missing/failed PostHog read must remain visible as unavailable data, not zero activity.
- Do not present the 30-day run rate as a predictive model; short ranges such as today can be volatile.
- Organizer "content changed" and follow-up timestamps can include trusted admin/service edits to the same event. Use them for operational relaunches, not as exact organizer session counts.
- Do not expand organizer attribution beyond the explicit UTM allowlist or persist campaign parameters in browser storage.
- Use environment variable names, not values.
- Do not use analytics identity as proof that a user should be synced to marketing contacts; Resend sync must validate the Supabase session separately.
- Do not couple onboarding tab-bar visibility to analytics identity; it is a navigation-shell concern only.
- Do not reinterpret sponsor `click_count` as unique people or join it to runner analytics identities.

## Related Docs

- [Mobile App](../01-architecture/mobile-app.md)
- [Web App](../01-architecture/web-app.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [Auth Flows](../04-auth-and-security/auth-flows.md)
