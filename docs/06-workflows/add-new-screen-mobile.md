---
title: Add New Mobile Screen
scope: workflow
last_verified: 2026-08-31
ai_priority: medium
related_files:
  - apps/mobile/app
  - apps/mobile/app/(app)/_layout.tsx
  - apps/mobile/components/navigation/AppHeaderTitle.tsx
  - apps/mobile/app/(app)/catalog.tsx
  - apps/mobile/app/(app)/race/_layout.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/components/race/RacebookLeafletMap.tsx
  - apps/mobile/components/race/RaceEventSummaryCard.tsx
  - apps/mobile/app/(app)/training-live.tsx
  - apps/mobile/app/(app)/plan/[id]/summary.tsx
  - apps/mobile/app/_layout.tsx
  - apps/mobile/components/navigation/FloatingActionMenu.tsx
  - apps/mobile/components/navigation/RootScreenActionMenu.tsx
  - apps/mobile/lib/racebook.ts
  - apps/mobile/lib/racebookSponsors.ts
  - apps/mobile/lib/racebookSponsorPresentation.ts
  - apps/mobile/locales/types.ts
  - apps/mobile/locales/fr.ts
  - apps/mobile/locales/en.ts
  - apps/mobile/lib/planShareLinks.ts
  - apps/mobile/lib/webApi.ts
  - apps/mobile/lib/posthog.ts
  - apps/mobile/hooks/usePremium.ts
  - apps/mobile/app.config.ts
related_tables:
  - race_relay_points
  - race_event_edition_sponsors
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
- Bottom tab safe area: keep the visible tab bar's height and bottom padding derived from `useSafeAreaInsets()` so Android three-button navigation cannot cover its actions.
- Hidden detail headers with custom left/right actions should reserve title space through `headerTitleContainerStyle` in the parent layout or screen options. On narrow iPhones, prefer shared one-line truncation in `AppHeaderTitle` over wrapped titles that can collide with header icons.
- Root tab actions: primary tab screens hide the native header and place global actions in `components/navigation/RootScreenActionMenu.tsx`, backed by `FloatingActionMenu.tsx`. Add safe-area top padding in the screen content when the header is hidden; keep the floating menu close to the bottom tab bar and use its dimmed backdrop/neutral action surfaces for readable contrast.
- Non-root plan actions can reuse `FloatingActionMenu` directly. The component keeps its default add icon for root menus but also accepts optional closed/open icons when a screen needs an actions affordance instead of a create affordance.
- Hidden utility screens, such as free training live and plan recap, should be registered as non-tab `Tabs.Screen` entries with `href: null` and a clear header title in `apps/mobile/app/(app)/_layout.tsx`. Add the specific dynamic child route too, not only the parent route, so Expo Router does not surface it as an automatic bottom-tab item. Use `href: null` alone when the screen should keep the bottom navigation visible; add `tabBarStyle: { display: 'none' }` only for flows that should hide the bar. The default root tab is `catalog`. Preserve the tab navigator's history-based back behavior so Android hardware back returns to the actual previous screen after these hidden routes are pushed.
- Compact detail routes under an existing stack, such as `race/[id]/racebook`, can keep a route-local tab bar/state machine. Keep the Racebook entry point hidden until the course format is live, `racebook_is_live` is true, and real organizer content exists; aid stations alone should not unlock it. Preserve the existing identity card: its flexible metadata row uses calendar/location icons, dot separators, and compact `Solo` and/or `Relais` badges, with two separate badges for mixed formats. Keep its emphasized localized format-date row when that date differs from the event start date, alerts, four permanent tabs, conditional Services tab, responsive location, route, ravito, and pull-to-refresh behavior. Inside `Course`, keep important schedule information above the compact `Tracé` / `Ravitos` / conditional `Relais` sub-tabs so the map/profile and long station lists no longer share one continuous scroll. Keep ravito rows collapsed by default with essential distance, service, segment-elevation, and cutoff context in the summary; only one row expands at a time to show products, notes, and full labeled details. In `Dossard`, render each pickup address directly without a repeated numbered location heading. In `Accès`, honor every format-level enabled flag, put notes/restrictions first, deduplicate identical start/finish addresses, use labeled Maps actions instead of raw URLs, and keep parking/navette detail rows collapsed until requested. Keep feedback in the native header except during the dedicated initial loading composition, then restore it with the bottom tab bar before content appears. Render conditional official-site, Instagram, and Facebook actions as accessible icon-only outlined controls beside the identity, then separate the emergency row with a divider. That row keeps `Urgence - nom - téléphone` on one line beside a localized outlined call action, and uses the display-normalized phone without separators for its `tel:` URL.
- The Racebook publication requirement above applies to ordinary runners. An active organizer of the parent event may preview the same populated Racebook before publication after both the catalog and direct screen load verify `race_event_organizers`; aid stations alone still do not unlock it.
- RaceBook sponsors come from the lightweight web API bridge. Start the request and loading-logo warmup from the Courses action before navigation, reuse the short-lived account/race-scoped in-flight request on the destination, and preserve a complete direct-link fallback. Hold the progress trail at its initial position until that preparation settles so logos are present before visible progress begins. The initial screen groups its localized title, thin unframed-runner progress trail, and one unified sponsor panel closely together. The panel reserves two vertical slots with one divider (roughly one third of the viewport) and disappears if the lookup settles empty. Hide feedback and the bottom navigation only for this state, restore both on completion/unmount, let progress stop below completion while work remains, and visibly reach 100% before replacing the loader. Keep the 2.5-second gate conditional on ready loading sponsors and skip it on pull-to-refresh. In the compact banner, rotate every sponsor through viewport-sized slides on a three-second cadence, loop with a duplicate first slide, and preserve the manual list for reduced motion.
- Relay segments belong in the conditional `Relais` sub-tab of the existing Racebook `Course` tab. Derive them from published relay points instead of creating another route or treating handovers as nutrition stations.
- In the Racebook `Services` tab, keep each populated category in its own titled card and render its content as plain text without list bullets.
- Plan recap/share screens should live under the existing hidden `plan` route group, read the saved plan, and use native sharing for external team handoffs. For shareable recap links, call the authenticated web API bridge from `apps/mobile/lib/planShareLinks.ts`; do not put service-role behavior in mobile code. Preserve per-checkpoint assistance availability in the generated snapshot so recap screens can highlight crew handoff points, mute no-assistance points, and avoid showing a product handoff block where the crew cannot be present.
- Dense setup screens can collapse secondary controls by default when the collapsed state still shows the key values needed to understand the current configuration.
- Keep only Plan profile setup inside the hidden onboarding shell. Course, product, plan, and RaceBook guidance must route through their real screens with the localized `OnboardingGuideCard` and ordinary tab navigation.
- Persist each tour independently as pending, in-progress, skipped, or completed. Local progress may resume a stage, but the Profile notification dot must use the durable profile statuses.
- Keep guided-route behavior behind an explicit `onboarding` parameter. Normal Courses, Nutrition, plan creation, and RaceBook behavior must remain unchanged when it is absent.
- When a mobile screen embeds public formats under `race_events`, use an explicit live-format relation filter; use `!inner` when parent events with no visible formats must also disappear. RLS/public flags alone do not filter the embedded array in this schema.
- When extending the Courses tab, preserve its event-level route contract: favorites stay tied to `race_events`; a confirmed favorite addition shows localized success feedback and scrolls to the event's new pinned position; organizer-update links add `updateId` and optional `raceId` to the catalog route so the existing event sheet opens the precise message and format context; the light-green update panel follows every format action, shows only the newest or targeted message while collapsed, and reveals older messages plus lazy-loaded history through `View more`.
- Premium purchase UI that can trigger App Store review should keep the subscription summary plus both legal links close to the CTA: explicit title, duration, price, privacy policy, and Terms of Use (EULA).
- Native changes require a new platform-compatible EAS Update runtime. The current release keeps iOS on `1.1.0` and uses the Android-specific `1.1.1` runtime for the Android 16 / API 36 binary.

### Racebook Identity Presentation

The identity card displays the formatted course date beneath the race name in the compact calendar metadata style, not the event date range. Keep metadata text compact with calendar/location icons, dot separators, and participation badges so it remains readable on one line when possible. The emergency row shows only `Urgence` and the optional contact name beside its localized outlined call action; retain the normalized phone solely for the `tel:` URL.

## Steps

1. Read [../01-architecture/mobile-app.md](../01-architecture/mobile-app.md).
2. Pick the route group under `apps/mobile/app`.
3. Create the screen file with Expo Router conventions.
4. Use existing mobile components/styles before introducing new primitives.
5. If the screen needs auth, use existing session helpers and route patterns.
6. If the screen offers social sign-in, keep the provider platform-specific: Apple on iOS, Google on Android.
7. If the screen needs premium access, read `apps/mobile/hooks/usePremium.ts`.
8. If the screen calls server functionality, prefer existing web API bridge patterns.
9. Add localized strings through the existing locale files when the UI needs text. Preserve language-specific punctuation such as French typographic apostrophes, including in notification copy.
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

For Android production OTA updates, resolve and verify the Android runtime before publishing; the API 36 binary expects runtime `1.1.1` while the current iOS binary remains on `1.1.0`.

For App Store subscription work, verify on iPhone and iPad layouts that the purchase surface still exposes functional privacy and Terms/EULA links without truncation.

## Do Not

- Do not assume Expo Go can test screens that depend on native modules.
- Do not paste PostHog keys or Supabase keys into source/docs.
- Do not bypass RevenueCat/subscription sync for premium screens.
- Do not call service-role-only web routes from the mobile client.
- Do not add one-off global session effects inside a screen; keep them in `_layout.tsx` or a dedicated helper with idempotency guards.
- Do not render Google sign-in on iOS builds. Use the shared auth hooks so provider availability stays platform-specific.
- Do not add `@react-native-google-signin/google-signin` back into `apps/mobile/app.config.ts` for iOS-only URL-scheme convenience; in this app, iOS must stay on the browser OAuth path unless the full native iOS integration is intentionally restored.
- Do not use React Native's raw `Text` for normal app UI; it bypasses the shared Bricolage Grotesque and JetBrains Mono typography.
- Do not reintroduce duplicate header titles on root tab screens unless the tab bar no longer identifies the current section.
- Do not put root-tab help, feedback, or create actions back into the native header; use the floating root action menu so the screen keeps the reclaimed vertical space.
- Do not remove the opened menu backdrop or high-contrast action styling unless replacing it with an equally readable treatment across busy root screens.
- Do not expose temporary flows like free training as new bottom tabs unless they become primary navigation destinations.
- Do not rely on a hidden parent route to hide every nested Expo Router screen. Register important dynamic children explicitly when adding plan/race utility screens, and choose separately whether the tab bar itself remains visible.
- Do not switch the tab shell back to `backBehavior: 'initialRoute'` for hidden child flows unless you explicitly want Android hardware back to jump to the default tab instead of the previous screen.
- Do not replace the inset-aware visible tab bar sizing with a fixed height; Android system navigation modes reserve different bottom areas.
- Do not hide subscription legal links in a distant settings screen when the active surface is an in-app paywall; premium upgrade prompts should expose privacy and Terms/EULA directly.
- Do not publish one undifferentiated OTA when platform runtimes differ. Publish and verify Android and iOS updates against their own resolved runtimes.

## Related Docs

- [Mobile App](../01-architecture/mobile-app.md)
- [Premium Entitlement](../03-business-rules/premium-entitlement.md)
- [Analytics](../05-integrations/analytics.md)
- [Design Components](../07-design-system/components.md)
