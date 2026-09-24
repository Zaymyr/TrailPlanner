---
title: Add New Mobile Screen
scope: workflow
last_verified: 2026-09-24
ai_priority: medium
related_files:
  - apps/mobile/app
  - apps/mobile/app/(app)/_layout.tsx
  - apps/mobile/components/navigation/AppHeaderTitle.tsx
  - apps/mobile/app/(app)/catalog.tsx
  - apps/mobile/hooks/useGuestAccountPrompt.ts
  - apps/mobile/app/(app)/race/_layout.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/components/racebook/RacebookAccessSection.tsx
  - apps/mobile/components/racebook/RacebookAidStationsSection.tsx
  - apps/mobile/components/racebook/RacebookCollapsibleHero.tsx
  - apps/mobile/components/racebook/RacebookSponsorExperience.tsx
  - apps/mobile/components/racebook/RacebookTabBar.tsx
  - apps/mobile/components/racebook/RacebookStructuredCourseSections.tsx
  - apps/mobile/components/race/RacebookLeafletMap.tsx
  - apps/mobile/components/race/RaceEventSummaryCard.tsx
  - apps/mobile/app/(app)/training-live.tsx
  - apps/mobile/components/race/TrainingLiveSession.tsx
  - apps/mobile/app/(app)/plan/[id]/summary.tsx
  - apps/mobile/lib/planDeparture.ts
  - apps/mobile/lib/planDeparture.test.ts
  - apps/mobile/app/_layout.tsx
  - apps/mobile/hooks/useSessionSideEffects.ts
  - apps/mobile/components/navigation/FloatingActionMenu.tsx
  - apps/mobile/components/navigation/RootScreenActionMenu.tsx
  - apps/mobile/components/inputs/NumericKeyboardAccessory.tsx
  - apps/mobile/lib/racebook.ts
  - apps/mobile/lib/fetchWithTimeout.ts
  - apps/mobile/lib/racebookOnboarding.ts
  - apps/mobile/lib/racebookSponsors.ts
  - apps/mobile/lib/racebookSponsorPresentation.ts
  - packages/design-system/src/branding.ts
  - apps/mobile/locales/types.ts
  - apps/mobile/locales/fr.ts
  - apps/mobile/locales/en.ts
  - apps/mobile/lib/planShareLinks.ts
  - apps/mobile/lib/planShareLinks.test.ts
  - apps/mobile/lib/webApi.ts
  - apps/mobile/lib/posthog.ts
  - apps/mobile/hooks/usePremium.ts
  - apps/mobile/app.config.ts
related_tables:
  - race_relay_points
  - race_event_edition_sponsors
  - race_event_edition_branding
---

# Add New Mobile Screen

## Purpose

Use this workflow when adding a screen to the Expo Router mobile app.

## Key Concepts

RaceBook screens must treat the effective module map as additive server data: hide disabled tabs or sub-tabs, but default to the historical visible behavior when an older bootstrap omits the map during a rolling deployment.

- Route file: file under `apps/mobile/app`.
- App shell: global providers and auth handling in `_layout.tsx`.
- Premium gate: access checks from `usePremium`; every consumer shares the same entitlement monitor and must not add screen-local Auth/AppState refresh listeners.
- Analytics screen: PostHog screen name from route segments.
- RaceBook analytics: the existing RaceBook route adds stable race/event properties and foreground engagement events after its publication/content gate succeeds; sponsor reporting stays separate.
- App-wide session side effect: behavior coordinated by `_layout.tsx` or its `useSessionSideEffects` helper, such as push registration or Resend contact sync, not inside an individual screen.
- Mobile typography: user-facing copy should render through `components/themed/Text` or `Heading`; numeric metrics, timings, distances, and nutrition values should use `components/themed/DataText`. The root layout loads exact font-weight subpaths so unused package weights are not bundled.
- Root tabs: primary tab screens rely on the bottom tab label for orientation and intentionally omit a duplicate header title; their established order is Courses, Plans, Nutrition, Profile. Pushed or hidden detail screens should keep a clear header title.
- Bottom tab safe area: keep the visible tab bar's height and bottom padding derived from `useSafeAreaInsets()` so Android three-button navigation cannot cover its actions.
- A modal sheet must set `accessibilityViewIsModal`, expose its title as an accessibility header, and give each icon-only dismissal control a localized label plus a 44-point target or equivalent hit slop. Keep the backdrop out of the VoiceOver focus order.
- Hidden detail headers with custom left/right actions should reserve title space through `headerTitleContainerStyle` in the parent layout or screen options. On narrow iPhones, prefer shared one-line truncation in `AppHeaderTitle` over wrapped titles that can collide with header icons.
- Numeric, decimal, and pace `TextInput` controls must set `inputAccessoryViewID="pace-yourself-numeric-keyboard"`. The authenticated app shell mounts the matching shared iOS accessory so users always have a `Terminé` action; Android ignores it.
- Root tab actions: primary tab screens hide the native header and place global actions in `components/navigation/RootScreenActionMenu.tsx`, backed by `FloatingActionMenu.tsx`. Add safe-area top padding in the screen content when the header is hidden; keep the floating menu close to the bottom tab bar and use its dimmed backdrop/neutral action surfaces for readable contrast. The shared root menu uses an ellipsis because it combines contextual creation with help and feedback.
- Non-root plan actions can reuse `FloatingActionMenu` directly. The component keeps its default add icon but also accepts optional closed/open icons when a screen needs a broader actions affordance instead of a create affordance.
- Hidden utility screens, such as free training live and plan recap, should be registered as non-tab `Tabs.Screen` entries with `href: null` and a clear header title in `apps/mobile/app/(app)/_layout.tsx`. Add the specific dynamic child route too, not only the parent route, so Expo Router does not surface it as an automatic bottom-tab item. Use `href: null` alone when the screen should keep the bottom navigation visible; add `tabBarStyle: { display: 'none' }` only for flows that should hide the bar. The default root tab is `catalog`. Preserve the tab navigator's history-based back behavior so Android hardware back returns to the actual previous screen after these hidden routes are pushed.
- Compact detail routes under an existing stack, such as `race/[id]/racebook`, can keep a route-local state machine and replace the global bottom bar while focused. The RaceBook contextual bar must expose every effective primary section with a filled Ionicon and visible label, use color alone for its selected icon/text, respect the bottom safe area, provide an explicit Courses exit, and restore the global navigation on blur. Keep the Racebook entry point hidden until the course format is live, `racebook_is_live` is true, and real organizer content exists; aid stations alone should not unlock it. Preserve the branded identity hero: it uses the format image before the event fallback, a primary-color overlay, the published edition logo, event and format names, course date, linked location, icon-led participation metadata, distance, D+ and optional D-, alerts, responsive location, route, ravito, and pull-to-refresh behavior. Keep accessible website and social icons at the hero's right edge in both expanded and compact states; do not recreate a mostly empty standalone card for them. The hero replaces the native RaceBook header, uses the return row for its title, and collapses progressively into a safe-area-aware sticky identity bar. Reset it to the expanded top position whenever the route regains focus. Put the emergency contact and number on one aligned line with its call control in the expanded hero, reduce them to one telephone icon before social actions when compact, and truncate a long title before this fixed action group. Inside `Course`, keep important schedule information above the compact sub-tabs so the map/profile and long station lists no longer share one continuous scroll, and render the schedule's own finish-cutoff label instead of shortening it to `Arrivée`. Present ravitos on one continuous vertical chronology: render departure and arrival as full-width cards at the content edge without separate markers, let the rail visually leave the departure card and enter the finish card, show cumulative distance, services and cutoff in each station card, and keep the segment distance, D+ and D- block visible with a rightward indent relative to each station card. Treat a published station at the race distance as the finish instead of another numbered ravito. Use the theme's contrast-safe accent foreground/graphic variants on tinted segment surfaces. Only stations with products or notes expand, and only one can be open at a time. In `Dossard`, render each pickup address directly without a repeated numbered location heading, cap its visible text at two lines, and retain the complete value in the link's accessibility label. In `Accès`, honor every format-level enabled flag, put notes/restrictions first, deduplicate identical start/finish addresses, use labeled Maps actions instead of raw URLs, and keep parking/navette detail rows collapsed until requested. Keep runner information in its neutral card only when present; the emergency `tel:` URL uses the display-normalized phone without separators.
- Keep native back labels minimal on dynamic routes so route templates never appear in the header. A RaceBook must expose an explicit back action that follows usable history first and falls back to the catalog when no history exists.
- Extend the existing `RacebookAccessSection`, `RacebookAidStationsSection` and `RacebookStructuredCourseSections` for their respective presentation blocks instead of growing the route again. Keep data normalization and analytics callbacks in the route, and pass explicit localized copy and the resolved theme into the presentational component.
- Format-specific runner information in the identity card requires both the format access override and its runner-info flag; stored text must remain hidden when either control is off.
- Shared catalog components must accept a nullable D+ from `races`: display `D+ non renseigné`, never coerce it to zero, and disable plan creation until a verified value exists.
- The Racebook publication requirement above applies to ordinary runners, but course discovery is broader: Courses shows preview-selected private formats to every runner for plan creation and removes every masked format (`racebook_preview_is_visible = false`) from cards, counts, deep links, and format sheets. After verifying `race_event_organizers`, a private format additionally receives a dimmed functional RaceBook preview action. The direct screen still verifies membership, and aid stations alone do not unlock it.
- RaceBook sponsors come from the lightweight web API bridge. Start the request and loading-logo warmup from the Courses action before navigation, reuse the short-lived account/race-scoped in-flight request on the destination, and preserve a complete direct-link fallback. Await the actual resolved bootstrap before revealing content; do not substitute a permanent default result merely because a short presentation timeout elapsed. Hold the progress trail at its initial position until that preparation settles so logos are present before visible progress begins. The initial screen groups its localized title, thin unframed-runner progress trail, and one unified sponsor panel closely together. The panel reserves two vertical slots with one divider (roughly one third of the viewport) and disappears if the lookup settles empty. Hide feedback and the bottom navigation only for this state, restore both on completion/unmount, let progress stop below completion while work remains, and visibly reach 100% before replacing the loader. Keep the 2.5-second gate conditional on ready loading sponsors and skip it on pull-to-refresh. In the compact banner, rotate every sponsor through viewport-sized slides on a three-second cadence, loop with a duplicate first slide, and preserve the manual list for reduced motion.
- RaceBook edition branding travels in that same additive response. Resolve it through `packages/design-system/src/branding.ts`; its shared logo flag must be honored before any prefetch or render. Use the raw primary on solid branded identity/navigation surfaces with `onPrimaryColor`, derived foreground/graphic variants on white, primary-derived screen surfaces, and contrast-safe accent variants for route/profile strokes, checklist completion, decorative location/service actions, ravito segments, and structured Course cards. Keep semantic red/orange/blue states and native navigation outside organizer control. The Material checklist persists owner-scoped item keys by exact race id, updates optimistically, and rolls back failed writes without modifying organizer equipment.
- Relay segments belong in the conditional `Relais` sub-tab of the existing Racebook `Course` tab. Derive them from published relay points instead of creating another route or treating handovers as nutrition stations.
- In the Racebook `Services` tab, keep each populated category in its own titled card and render its content as plain text without list bullets.
- Plan recap/share screens should live under the existing hidden `plan` route group, read the saved plan, and reload it whenever the recap screen regains focus after an edit. List cards use their main surface to open or edit and a long-press management sheet containing direct name editing plus deletion with confirmation; expose the same sheet to screen readers and document the gesture in contextual help. Recap, Share, and start/resume stay in a compact right-side icon rail with localized accessibility labels, leaving the card body for Total time, Ravitos, and live departure countdown cells. Total time must reuse the saved-plan section calculation, including pauses, terrain, fatigue, and custom segment pacing; never introduce a list-only `distance / speed` estimate. A list-level Share shortcut should build the same saved recap and open the native share sheet in place; when the runner override, a single parseable organizer schedule, and the first start wave cannot provide a dated departure, explain the missing input and route to the recap to set it. Regenerated totals and checkpoint times must use the plan editor's exact section durations, while a manually selected departure time remains a per-plan local preference and must not be reset by the reload. Once recap data and departure time are ready, synchronize the public snapshot through `apps/mobile/lib/planShareLinks.ts` so an existing stable URL immediately reflects the regenerated values; the explicit native-share action must reuse the same deduplicated request/result. Do not put service-role behavior in mobile code. Preserve per-checkpoint assistance availability in the generated snapshot so recap screens can highlight crew handoff points, mute no-assistance points, and avoid showing a product handoff block where the crew cannot be present.
- Dense setup screens can collapse secondary controls by default when the collapsed state still shows the key values needed to understand the current configuration.
- Keep free-training setup/session orchestration in its route, while the active-session rendering stays in `components/race/TrainingLiveSession.tsx`; that presentation component consumes computed live state and must not duplicate nutrition or alert scheduling rules.
- Keep only Plan profile setup inside the hidden onboarding shell. Course, product, plan, and RaceBook guidance must route through their real screens with the localized `OnboardingGuideCard` and ordinary tab navigation.
- Persist each tour independently as pending, in-progress, skipped, or completed. Local progress may resume a stage, but the Profile notification dot must use the durable profile statuses.
- Keep guided-route behavior behind an explicit `onboarding` parameter. Normal Courses, Nutrition, plan creation, and RaceBook behavior must remain unchanged when it is absent.
- Guided RaceBook discovery must require a deliberate two-character search, reuse the ordinary `canShowRacebook` publication/content gate, remove the competing plan action, and track search/event/format selection without sending the search text.
- When a mobile screen embeds public formats under `race_events`, use an explicit live-format relation filter; use `!inner` when parent events with no visible formats must also disappear. RLS/public flags alone do not filter the embedded array in this schema.
- When extending the Courses tab, preserve its event-level route contract: favorites stay tied to `race_events`; an identified runner's card-local heart may flip in the same interaction frame and animate optimistically, but it must resynchronize with the server result and preserve the current list order and viewport until the next load or refresh applies the confirmed pinned order; a guest heart must open the account prompt without flipping. Organizer-update links add `updateId` and optional `raceId` to the catalog route so the existing event sheet opens the precise message and format context; the light-green update panel follows every format action, shows only the newest or targeted message while collapsed, and reveals older messages plus lazy-loaded history through `View more`.
- Premium purchase UI that can trigger App Store review should keep the subscription summary plus both legal links close to the CTA: explicit title, duration, price, privacy policy, and Terms of Use (EULA).
- Native changes require a new platform-compatible EAS Update runtime. The current source targets shared runtime `1.1.1`; the light iOS appearance requires a new iOS `1.1.1` binary before its OTA channel receives `1.1.1` updates.

### Racebook Identity Presentation

The expanded identity hero displays the formatted course date beneath the race name, not the event date range. Keep date, location, and participation as compact icon-led metadata, and place the heading beside the back action instead of leaving that row empty. Its collapsed state keeps the back action, social links, and a title clipped before the fixed action group in the top safe area without duplicating a native header. Put a valid emergency number and explicit call action in the expanded hero's lower free space; when compact, replace that row with one labeled telephone icon before the social actions. Retain the normalized number for the `tel:` URL.

## Steps

1. Read [../01-architecture/mobile-app.md](../01-architecture/mobile-app.md).
2. Pick the route group under `apps/mobile/app`.
3. Create the screen file with Expo Router conventions.
4. Use existing mobile components/styles before introducing new primitives.
5. If the screen needs auth, use existing session helpers and route patterns. When an action stays visible to a guest but requires an identified account, call `useGuestAccountPrompt` before optimistic state or persistence so the runner can either create an account or sign in to an existing one.
6. If the screen offers social sign-in, keep the provider platform-specific: Apple on iOS, Google on Android.
7. If the screen needs premium access, read `apps/mobile/hooks/usePremium.ts`.
8. If the screen calls server functionality, prefer existing web API bridge patterns.
9. Add localized strings through the existing locale files when the UI needs text. Preserve language-specific punctuation such as French typographic apostrophes, including in notification copy.
10. Import mobile text from `components/themed/Text` / `Heading`, not from `react-native`; use `DataText` for metric-like values.
11. Track analytics with helpers in `apps/mobile/lib/posthog.ts` when consistent with nearby screens. Emit outcome events only after the server confirms the mutation; for notification responses, keep properties bounded and never attach hrefs or message content.
    The app shell owns analytics identity and marks the configured owner email plus trusted Supabase admins as PostHog internal/test users; screens must not reimplement that classification.
12. For a new root tab, add the help/feedback entry point through `RootScreenActionMenu`; add screen-specific actions there instead of occupying native header space.
13. For a new hidden child screen under an existing stack, register the explicit child route in `apps/mobile/app/(app)/_layout.tsx` and give it a localized title in the stack layout for that feature area.
14. When the screen belongs to a critical user journey, add stable, semantic `testID` hooks to the smallest actionable elements and extend `apps/mobile/.maestro/flows/authenticated-shell.yaml` or add a focused flow. Do not target translated copy when a stable id is available.

## Validation

For Courses visibility work, verify both roles across all three states: runners never see masked formats, see private formats with plan creation but no RaceBook action, and see public formats normally; active organizers also see no masked formats, see private formats with a dimmed functional RaceBook action, and see public formats normally. Keep the organizer merge bounded by membership event ids, filter masked rows after merging, and deduplicate stable race ids.

Run typecheck/test where available:

```bash
npm run typecheck
npm run test
```

For native behavior, build/run with the development client profile from `apps/mobile/eas.json`. That profile sets `APP_VARIANT=development` and installs as `Pace Yourself Dev` (`com.paceyourself.app.dev`) beside production. Set the same variable before starting Expo locally; in PowerShell, run `$env:APP_VARIANT = "development"` before `npm run dev:mobile`.

For the cross-platform authenticated shell audit, follow [Mobile UX Audit](mobile-ux-audit.md). Run `npm run test:e2e:ux -w @trailplanner/mobile` locally when Maestro and an installed build are available, or launch the manual EAS workflow.

For production OTA updates, resolve and verify runtime `1.1.1` on both platforms. Do not publish an iOS `1.1.1` OTA until a matching iOS binary containing the light appearance configuration is installed or released.

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
- Do not publish an OTA across incompatible native runtimes. The current release line uses `1.1.1` on both platforms, but older iOS `1.1.0` binaries must remain isolated from its updates.
- Do not apply organizer accent colors to semantic status UI or expose an unpublished branding draft through a mobile screen.
- Do not store test credentials in a flow, snapshot, source file, or public Expo environment variable.

## Related Docs

Mobile RaceBook entry points must pass preview selection plus publication/organizer access through `canShowRacebook`; screens must not recreate those gates locally.

- [Mobile App](../01-architecture/mobile-app.md)
- [Premium Entitlement](../03-business-rules/premium-entitlement.md)
- [Analytics](../05-integrations/analytics.md)
- [Design Components](../07-design-system/components.md)
