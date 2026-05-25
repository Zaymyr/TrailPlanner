---
title: Analytics
scope: integration
last_verified: 2026-05-19
ai_priority: medium
related_files:
  - apps/web/lib/posthog-config.ts
  - apps/web/lib/posthog-browser.ts
  - apps/web/app/posthog-provider.tsx
  - apps/web/app/analytics.tsx
  - apps/mobile/lib/posthog.ts
  - apps/mobile/app/_layout.tsx
related_tables: []
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

## Gotchas

- Never paste real PostHog keys into docs.
- Do not include sensitive URL tokens in analytics paths.
- Web analytics are consent-gated; mobile analytics default opt-in is configured in the native PostHog client.
- Use environment variable names, not values.
- Do not use analytics identity as proof that a user should be synced to marketing contacts; Resend sync must validate the Supabase session separately.

## Related Docs

- [Mobile App](../01-architecture/mobile-app.md)
- [Web App](../01-architecture/web-app.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [Auth Flows](../04-auth-and-security/auth-flows.md)
