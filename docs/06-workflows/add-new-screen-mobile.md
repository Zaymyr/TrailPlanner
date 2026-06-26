---
title: Add New Mobile Screen
scope: workflow
last_verified: 2026-06-26
ai_priority: medium
related_files:
  - apps/mobile/app
  - apps/mobile/app/(app)/_layout.tsx
  - apps/mobile/app/(app)/catalog.tsx
  - apps/mobile/app/(app)/race/_layout.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/components/race/RaceEventSummaryCard.tsx
  - apps/mobile/app/(app)/training-live.tsx
  - apps/mobile/app/(app)/plan/[id]/summary.tsx
  - apps/mobile/app/_layout.tsx
  - apps/mobile/components/navigation/FloatingActionMenu.tsx
  - apps/mobile/components/navigation/RootScreenActionMenu.tsx
  - apps/mobile/lib/racebook.ts
  - apps/mobile/lib/planShareLinks.ts
  - apps/mobile/lib/webApi.ts
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
- Non-root plan actions can reuse `FloatingActionMenu` directly. The component keeps its default add icon for root menus but also accepts optional closed/open icons when a screen needs an actions affordance instead of a create affordance.
- Hidden utility screens, such as free training live and plan recap, should be registered as non-tab `Tabs.Screen` entries with `href: null` and a clear header title in `apps/mobile/app/(app)/_layout.tsx`. Add the specific dynamic child route too, not only the parent route, so Expo Router does not surface it as an automatic bottom-tab item. Use `href: null` alone when the screen should keep the bottom navigation visible; add `tabBarStyle: { display: 'none' }` only for flows that should hide the bar.
- Compact detail routes under an existing stack, such as `race/[id]/racebook`, can keep a route-local tab bar/state machine instead of introducing a shared navigation primitive when the screen is read-only and scoped to one flow. Keep the entry point hidden until the format is live and has real organizer content; aid-station rows alone should not unlock it. For Racebook specifically, keep the header aligned with the format date and race metrics, lift any organizer last-minute message into its own alert card above the tabs, keep remaining service copy in Profile, render start and bib data in table-like label/value rows, keep gear status badges inside the card width, and present ravitos as a two-column layout with the right column reserved for km, D+, D-, and cutoff time.
- Plan recap/share screens should live under the existing hidden `plan` route group, read the saved plan, and use native sharing for external team handoffs. For shareable recap links, call the authenticated web API bridge from `apps/mobile/lib/planShareLinks.ts`; do not put service-role behavior in mobile code. Preserve per-checkpoint assistance availability in the generated snapshot so recap screens can highlight crew handoff points, mute no-assistance points, and avoid showing a product handoff block where the crew cannot be present.
- Dense setup screens can collapse secondary controls by default when the collapsed state still shows the key values needed to understand the current configuration.
- When a setup/onboarding step already sits inside a shell card, prefer flat rows for one-off lists; when the same choice exists as a primary app surface, reuse the primary component for consistency.
- Required onboarding screens must hide the bottom tab bar until completion; register them with `href: null` and `tabBarStyle: { display: 'none' }` in the tab layout.
- Onboarding product-picking should mirror the Nutrition catalog affordances: collapsed brand rows keep count/verified/selected signals, and product rows keep verified badges plus explicit selection checks. Ensure onboarding product queries include `is_official` when rendering those badges.
- Reuse `RaceEventSummaryCard` for catalog/onboarding race event rows so the onboarding race picker matches the Courses tab UX.

## Steps

1. Read [../01-architecture/mobile-app.md](../01-architecture/mobile-app.md).
2. Pick the route group under `apps/mobile/app`.
3. Create the screen file with Expo Router conventions.
4. Use existing mobile components/styles before introducing new primitives.
5. If the screen needs auth, use existing session helpers and route patterns.
6. If the screen offers social sign-in, keep the provider platform-specific: Apple on iOS, Google on Android.
7. If the screen needs premium access, read `apps/mobile/hooks/usePremium.ts`.
8. If the screen calls server functionality, prefer existing web API bridge patterns.
9. Add localized strings through the existing locale files when the UI needs text.
10. Import mobile text from `components/themed/Text` / `Heading`, not from `react-native`; use `DataText` for metric-like values.
11. Track analytics with helpers in `apps/mobile/lib/posthog.ts` when consistent with nearby screens.
12. For a new root tab, add the help/feedback entry point through `RootScreenActionMenu`; add screen-specific actions there instead of occupying native header space.
13. For a new hidden child screen under an existing stack, register the explicit child route in `apps/mobile/app/(app)/_layout.tsx` and give it a localized title in the stack layout for that feature area.

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
- Do not render Google sign-in on iOS builds. Use the shared auth hooks so provider availability stays platform-specific.
- Do not use React Native's raw `Text` for normal app UI; it bypasses the shared Bricolage Grotesque and JetBrains Mono typography.
- Do not reintroduce duplicate header titles on root tab screens unless the tab bar no longer identifies the current section.
- Do not put root-tab help, feedback, or create actions back into the native header; use the floating root action menu so the screen keeps the reclaimed vertical space.
- Do not remove the opened menu backdrop or high-contrast action styling unless replacing it with an equally readable treatment across busy root screens.
- Do not expose temporary flows like free training as new bottom tabs unless they become primary navigation destinations.
- Do not rely on a hidden parent route to hide every nested Expo Router screen. Register important dynamic children explicitly when adding plan/race utility screens, and choose separately whether the tab bar itself remains visible.

## Related Docs

- [Mobile App](../01-architecture/mobile-app.md)
- [Premium Entitlement](../03-business-rules/premium-entitlement.md)
- [Analytics](../05-integrations/analytics.md)
- [Design Components](../07-design-system/components.md)
