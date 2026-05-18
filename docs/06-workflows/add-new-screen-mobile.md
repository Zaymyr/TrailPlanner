---
title: Add New Mobile Screen
scope: workflow
last_verified: 2026-05-18
ai_priority: medium
related_files:
  - apps/mobile/app
  - apps/mobile/app/_layout.tsx
  - apps/mobile/lib/posthog.ts
  - apps/mobile/hooks/usePremium.ts
  - apps/mobile/app.config.ts
related_tables: []
---

# Add New Mobile Screen

## Purpose

Use this workflow when adding a screen to the Expo Router mobile app.

## Key Concepts

- Route file: file under `apps/mobile/app`.
- App shell: global providers and auth handling in `_layout.tsx`.
- Premium gate: access checks from `usePremium`.
- Analytics screen: PostHog screen name from route segments.
- Mobile typography: user-facing copy should render through `components/themed/Text` or `Heading`; numeric metrics, timings, distances, and nutrition values should use `components/themed/DataText`.

## Steps

1. Read [../01-architecture/mobile-app.md](../01-architecture/mobile-app.md).
2. Pick the route group under `apps/mobile/app`.
3. Create the screen file with Expo Router conventions.
4. Use existing mobile components/styles before introducing new primitives.
5. If the screen needs auth, use existing session helpers and route patterns.
6. If the screen needs premium access, read `apps/mobile/hooks/usePremium.ts`.
7. If the screen calls server functionality, prefer existing web API bridge patterns.
8. Add localized strings through the existing locale files when the UI needs text.
9. Import mobile text from `components/themed/Text` / `Heading`, not from `react-native`; use `DataText` for metric-like values.
10. Track analytics with helpers in `apps/mobile/lib/posthog.ts` when consistent with nearby screens.

## Validation

Run typecheck/test where available:

```bash
npm run typecheck
npm run test
```

For native behavior, build/run with the development client profile from `apps/mobile/eas.json`.

## Do Not

- Do not assume Expo Go can test screens that depend on native modules.
- Do not paste PostHog keys or Supabase keys into source/docs.
- Do not bypass RevenueCat/subscription sync for premium screens.
- Do not call service-role-only web routes from the mobile client.
- Do not use React Native's raw `Text` for normal app UI; it bypasses the shared Bricolage Grotesque and JetBrains Mono typography.

## Related Docs

- [Mobile App](../01-architecture/mobile-app.md)
- [Premium Entitlement](../03-business-rules/premium-entitlement.md)
- [Analytics](../05-integrations/analytics.md)
- [Design Components](../07-design-system/components.md)
