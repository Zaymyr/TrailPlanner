---
title: Add New Mobile Screen
scope: workflow
last_verified: 2026-05-19
ai_priority: medium
related_files:
  - apps/mobile/app
  - apps/mobile/app/(app)/training-live.tsx
  - apps/mobile/app/_layout.tsx
  - apps/mobile/components/navigation/FloatingActionMenu.tsx
  - apps/mobile/components/navigation/RootScreenActionMenu.tsx
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
- App-wide session side effect: behavior that belongs in `_layout.tsx`, such as push registration or Resend contact sync, not inside an individual screen.
- Mobile typography: user-facing copy should render through `components/themed/Text` or `Heading`; numeric metrics, timings, distances, and nutrition values should use `components/themed/DataText`.
- Root tabs: primary tab screens rely on the bottom tab label for orientation and intentionally omit a duplicate header title; pushed or hidden detail screens should keep a clear header title.
- Root tab actions: primary tab screens hide the native header and place global actions in `components/navigation/RootScreenActionMenu.tsx`, backed by `FloatingActionMenu.tsx`. Add safe-area top padding in the screen content when the header is hidden; keep the floating menu close to the bottom tab bar and use its dimmed backdrop/neutral action surfaces for readable contrast.
- Hidden utility screens, such as free training live, should be registered as non-tab `Tabs.Screen` entries with `href: null` and a clear header title in `apps/mobile/app/(app)/_layout.tsx`.
- Dense setup screens can collapse secondary controls by default when the collapsed state still shows the key values needed to understand the current configuration.

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
11. For a new root tab, add the help/feedback entry point through `RootScreenActionMenu`; add screen-specific actions there instead of occupying native header space.

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
- Do not add one-off global session effects inside a screen; keep them in `_layout.tsx` or a dedicated helper with idempotency guards.
- Do not use React Native's raw `Text` for normal app UI; it bypasses the shared Bricolage Grotesque and JetBrains Mono typography.
- Do not reintroduce duplicate header titles on root tab screens unless the tab bar no longer identifies the current section.
- Do not put root-tab help, feedback, or create actions back into the native header; use the floating root action menu so the screen keeps the reclaimed vertical space.
- Do not remove the opened menu backdrop or high-contrast action styling unless replacing it with an equally readable treatment across busy root screens.
- Do not expose temporary flows like free training as new bottom tabs unless they become primary navigation destinations.

## Related Docs

- [Mobile App](../01-architecture/mobile-app.md)
- [Premium Entitlement](../03-business-rules/premium-entitlement.md)
- [Analytics](../05-integrations/analytics.md)
- [Design Components](../07-design-system/components.md)
