---
title: Mobile App Architecture
scope: architecture
last_verified: 2026-05-17
ai_priority: high
related_files:
  - apps/mobile/package.json
  - apps/mobile/app.config.ts
  - apps/mobile/eas.json
  - apps/mobile/app/_layout.tsx
  - apps/mobile/hooks/usePremium.ts
  - apps/mobile/lib/race-import.ts
  - apps/mobile/lib/posthog.ts
related_tables:
  - races
  - race_events
  - subscriptions
  - user_profiles
  - push_devices
---

# Mobile App Architecture

## Purpose

The mobile app is the Expo Router client for onboarding, catalog browsing, plan creation, GPX import, premium state, push registration, and mobile analytics. Read this before changing native flows or EAS build assumptions.

## Key Concepts

- Expo Router: route files under `apps/mobile/app`.
- Development client: EAS development profile with `expo-dev-client`.
- App session: Supabase session synchronized into mobile helpers.
- RevenueCat: native in-app purchase source that syncs into Supabase subscriptions.
- Web API bridge: mobile calls selected Next.js API routes for operations that need server keys.

## Framework Setup

`apps/mobile/package.json` declares:

- `expo ~54.0.33`
- `expo-router ~6.0.23`
- `react 19.1.0`
- `react-native 0.81.5`
- `@supabase/supabase-js ^2.45.4`
- `expo-dev-client ~6.0.20`
- `expo-updates ~29.0.16`
- `react-native-purchases ^9.15.1`
- `posthog-react-native ^4.45.0`

The app config in `apps/mobile/app.config.ts` declares:

- app name `Pace Yourself`;
- slug `pace-yourself-app`;
- owner `pace-yourself`;
- scheme `paceyourself`;
- runtime version `1.1.0`;
- EAS project id `c713a8a0-cd94-4f6e-9468-063c9c20da6c`;
- update URL `https://u.expo.dev/c713a8a0-cd94-4f6e-9468-063c9c20da6c`.

## EAS Profiles

`apps/mobile/eas.json` defines:

- `development`: internal distribution and `developmentClient: true`.
- `preview`: internal distribution, Android APK, iOS Release.
- `production`: Android app bundle, iOS Release, auto-increment enabled.

Because the dependency set includes native modules such as `expo-dev-client`, `react-native-purchases`, notifications, secure store, and Apple auth, use the development client profile for realistic local/device testing. Expo Go can only be assumed for flows that do not require these native modules.

## App Shell

`apps/mobile/app/_layout.tsx` initializes:

- global error handling;
- fonts and splash handling;
- Expo Updates startup and foreground checks;
- Supabase auth state listeners;
- trial status initialization;
- premium state gating through `usePremium`;
- PostHog provider;
- push registration once a session is active.

The layout also tracks auth analytics for signed-in and signed-out events.

## Premium and Purchases

`apps/mobile/hooks/usePremium.ts` combines several signals:

- profile trial fields from `user_profiles`;
- web/API entitlements from `/api/entitlements`;
- `subscriptions` rows;
- active `premium_grants`;
- RevenueCat customer info.

When RevenueCat has an active entitlement and the server is not synced, mobile calls the web sync endpoint to persist the purchase into `subscriptions`.

## Race Import

`apps/mobile/lib/race-import.ts` handles mobile GPX document picking and private race creation. It:

- accepts GPX/XML/plain/octet-stream file types from `expo-document-picker`;
- parses GPX with `parseGpxForRaceImport`;
- builds localized import feedback;
- calls the web `/api/races` route with the bearer token;
- updates the created race to private/non-live via Supabase client.

## Analytics

`apps/mobile/lib/posthog.ts` enables PostHog only when `EXPO_PUBLIC_POSTHOG_KEY` or `EXPO_PUBLIC_POSTHOG_TOKEN` is present. The host defaults to `https://us.i.posthog.com` unless `EXPO_PUBLIC_POSTHOG_HOST` is configured.

Do not copy actual keys into docs. Use environment variable names only.

## Gotchas

- Mobile writes some private race cleanup directly through Supabase after calling the web API. RLS must continue to allow owner updates for private races.
- Mobile catalog and onboarding query `race_events` and `races.has_aid_stations`; visible migrations in this repo do not create all of those fields.
- Trial duration must remain aligned with web and migrations: 15 days.
- Do not treat RevenueCat as a separate entitlement table. It syncs into `subscriptions`.

## Related Docs

- [Overview](overview.md)
- [Add New Screen Mobile](../06-workflows/add-new-screen-mobile.md)
- [Premium Entitlement](../03-business-rules/premium-entitlement.md)
- [Trial Lifecycle](../03-business-rules/trial-lifecycle.md)
- [Analytics](../05-integrations/analytics.md)
