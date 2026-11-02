---
title: Add New Mobile Screen
scope: workflow
last_verified: 2026-11-02
ai_priority: medium
related_files:
  - apps/mobile/app
  - apps/mobile/app/(app)/_layout.tsx
  - apps/mobile/components/navigation/AppHeaderTitle.tsx
  - apps/mobile/components/navigation/RootCollapsibleHeader.tsx
  - apps/mobile/components/navigation/RootScreenActionMenu.tsx
  - apps/mobile/components/inputs/DatePickerField.tsx
  - apps/mobile/components/race/RaceRequestHeaderButton.tsx
  - apps/mobile/app/(app)/catalog.tsx
  - apps/mobile/app/(app)/plans.tsx
  - apps/mobile/app/(app)/nutrition.tsx
  - apps/mobile/app/(app)/profile.tsx
  - apps/mobile/components/plans/PlansList.tsx
  - apps/mobile/components/nutrition/NutritionContent.tsx
  - apps/mobile/hooks/useGuestAccountPrompt.ts
  - apps/mobile/app/(app)/race/_layout.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/components/racebook/RacebookAccessSection.tsx
  - apps/mobile/components/racebook/RacebookAidStationsSection.tsx
  - apps/mobile/components/racebook/RacebookPersonalPlanCard.tsx
  - apps/mobile/components/racebook/RacebookCollapsibleHero.tsx
  - apps/mobile/components/racebook/RacebookSponsorExperience.tsx
  - apps/mobile/components/racebook/RacebookTabBar.tsx
  - apps/mobile/components/plan-workspace/LockedPlanContent.tsx
  - apps/mobile/components/race-workspace/RaceWorkspaceSwitch.tsx
  - apps/mobile/components/race-workspace/RaceWorkspaceHeaderCommon.tsx
  - apps/mobile/lib/planPreviewBoundary.ts
  - apps/mobile/lib/planPreviewBoundary.test.ts
  - apps/mobile/components/racebook/RacebookStructuredCourseSections.tsx
  - apps/mobile/components/race/RacebookLeafletMap.tsx
  - apps/mobile/components/racebook/RacebookElevationProfile.tsx
  - apps/mobile/lib/racebookCourseVisuals.ts
  - apps/mobile/lib/racebookCourseVisuals.test.ts
  - apps/mobile/components/race/RaceEventSummaryCard.tsx
  - apps/mobile/app/(app)/training-live.tsx
  - apps/mobile/components/race/TrainingLiveSession.tsx
  - apps/mobile/app/(app)/plan/[id]/summary.tsx
  - apps/mobile/app/(app)/plan/[id]/edit.tsx
  - apps/mobile/components/plan-workspace/PlanWorkspaceHeader.tsx
  - apps/mobile/components/plan-workspace/PlanWorkspaceTabBar.tsx
  - apps/mobile/components/plan-workspace/PlanRecapContent.tsx
  - apps/mobile/components/plan-workspace/PlanWorkspaceStickyBar.tsx
  - apps/mobile/lib/planWorkspace.ts
  - apps/mobile/lib/planWorkspace.test.ts
  - apps/mobile/lib/planDeparture.ts
  - apps/mobile/lib/planDeparture.test.ts
  - apps/mobile/app/_layout.tsx
  - apps/mobile/hooks/useSessionSideEffects.ts
  - apps/mobile/components/navigation/FloatingActionMenu.tsx
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

The RaceBook Dossard rules accept optional third-party pickup conditions. Show them only when pickup by another person is allowed, preserve the organizer's text verbatim, and keep the mobile surface read-only; missing fields from older payloads must continue to normalize to `null`.

When a workspace switch is attached under a collapsible header, pass the header colors to `RaceWorkspaceSwitch` and render the header with `attachedBelow` so only the switch carries the rounded edge and shadow.

Screens that depend on plan entitlements should stay on their loading state until access is resolved for the current entity, using cached capabilities only as a timeout or network fallback.

For linked Plan/RaceBook workspaces, reuse `RaceWorkspaceHeaderCommon` so identity, official timing and the five course metrics keep one order and one position: start expanded content below `RACE_WORKSPACE_TOOLBAR_HEIGHT`, keep the 16-point gutter, pass screen-specific rows through `footer` (after the metrics only), and report the measured expanded height instead of a fixed constant. Treat plan entitlement as unknown until cached or verified capabilities exist; unknown UI is neutral and retryable, never a free preview.

Les espaces de travail contextuels n'ajoutent pas une action de sortie à leur barre basse : le Livret affiche exactement cinq onglets et l'éditeur trois. Le retour appartient à l'en-tête et au geste/bouton système. Dans un Livret, les interactions utilisent la palette Pace Yourself ; la couleur principale organisateur sert à l'identité et aux badges, et son accent au tracé et aux repères de ravito. Tous les textes visibles restent dans les locales.

The RaceBook `Ravitos` chronology is timing-first: do not render official or personal nutrition product lists or pauses in its station cards. Show the resolved departure once in the identity hero. When a dated departure exists, align one compact green `Passage prévu à : HH:mm` row immediately above the red cutoff row; pressing it opens the matching plan station. Add the plan-derived, pause-excluded segment duration to the blue connector. If passage is after the cutoff, expose a semantic warning icon whose press toggles a short explanation. Keep service availability and organizer notes accessible without duplicating the plan's nutrition editor.

Dynamic plan editor routes must scope every in-memory warm start to the exact plan id as well as its one-use token. When `[id]` changes, discard the previous route's warm start before initializing draft refs or autosave state.

Supporter-point cards keep Maps actions as right-aligned 44-point icon-only controls. Text labels remain in accessibility names; access notes and permissions stay in the compact card body.

RaceBook subviews may derive display-only personal values from cached plan summaries; missing official checkpoints must degrade to a deterministic estimate rather than hide the official row.

> Terminologie : les textes français destinés aux utilisateurs emploient **Livret coureur** et les textes anglais **Race Book**. Les identifiants techniques stables — routes, événements analytics, objets de base de données et valeurs historiques — conservent `racebook`.

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
- Store review: the root shell owns the returning-plan check after launch/onboarding overlays, while `appReviewPolicy.ts` owns eligibility, cooldown, and attempt limits. Screens may record successful plan milestones but must not launch their own native review dialog.
- Mobile typography: user-facing copy should render through `components/themed/Text` or `Heading`; comparable numeric metrics, timings, distances, and nutrition values should use `components/themed/DataText`. A value containing words, such as a departure status or product count, stays in the normal sans `Text`. The root layout loads exact font-weight subpaths so unused package weights are not bundled.
- Root tabs: primary tab screens hide the native header and use `RootCollapsibleHeader` for a consistent section identity that contracts from 76 to 60 points on scroll; their established order is Courses, Mes plans/My plans, Nutrition, Profile. The saved-plans tab label and root title must share the localized `plans.title` value while the route remains `plans`. Keep help and optional trailing actions at the 16-point gutter, keep the title's horizontal position stable, and let only its size change. Pushed or hidden detail screens should keep a clear native or route-specific header title; centered titles are reserved for detail contexts.
- Root-tab content uses a 16-point horizontal gutter and the themed `LoadingState`, `ErrorState`, and `EmptyState` primitives. A recoverable initial fetch must expose localized retry copy. Add pull-to-refresh to read-oriented lists when it cannot discard in-progress edits; form roots such as Profile intentionally omit gesture refresh. Keep an empty result separate from a failed request, and add an empty-state CTA only when one clear next action exists.
- Bottom tab safe area: keep the visible tab bar's height and bottom padding derived from `useSafeAreaInsets()` so Android three-button navigation cannot cover its actions.
- A modal sheet must set `accessibilityViewIsModal`, expose its title as an accessibility header, distinguish a failed load from an empty result with a localized retry when it fetches data, and give each icon-only dismissal control a localized label plus a 44-point target or equivalent hit slop. Keep the backdrop out of the VoiceOver focus order.
- Hidden detail headers with custom left/right actions should reserve title space through `headerTitleContainerStyle` in the parent layout or screen options. On narrow iPhones, prefer shared one-line truncation in `AppHeaderTitle` over wrapped titles that can collide with header icons.
- Numeric, decimal, and pace `TextInput` controls must set `inputAccessoryViewID="pace-yourself-numeric-keyboard"`. The authenticated app shell mounts the matching shared iOS accessory so users always have a `Terminé` action; Android ignores it. Inputs near the bottom of a parent scroll must also request a focus-time scroll after the keyboard opens; keyboard insets alone do not guarantee that Android keeps the active field visible.
- Root tab actions: every ordinary root tab gives the collapsible header's leading 44-point target to `RootScreenActionMenu`, which opens contextual help, feedback, and race request actions in both expanded and compact modes. Guided Courses onboarding omits it. The leading edge and the optional trailing action stay 16 points from the screen edge; only Nutrition currently keeps its product-create action. Plans uses its in-content training card, Courses moves requests into the help menu, and Profile uses a dirty-only bottom save dock. Both header and floating menus must consume Android back while open and close on backdrop/action. Start scroll content below the expanded header height and forward vertical scroll offsets to the shared header.
- Use the shared `DatePickerField` for native dates that should not summon the keyboard. Keep stored/API ISO dates unchanged, render locale-formatted values, provide explicit clearing where absence is allowed, and constrain related dates at the picker boundary. Because the picker is native, register its Expo plugin and require a new development/store binary; its lazy unavailable fallback protects older binaries from an early OTA.
- Non-root plan actions can reuse `FloatingActionMenu` directly. The component keeps its default add icon but also accepts optional closed/open icons when a screen needs a broader actions affordance instead of a create affordance.
- Hidden utility screens, such as free training live and plan recap, should be registered as non-tab `Tabs.Screen` entries with `href: null` and a clear header title in `apps/mobile/app/(app)/_layout.tsx`. Add the specific dynamic child route too, not only the parent route, so Expo Router does not surface it as an automatic bottom-tab item. Use `href: null` alone when the screen should keep the bottom navigation visible; add `tabBarStyle: { display: 'none' }` only for flows that should hide the bar. The default root tab is `catalog`. Preserve the tab navigator's history-based back behavior for ordinary hidden routes; a full-screen contextual mode such as RaceBook may intercept Android back locally when every exit must return to one explicit root tab.

- Compact detail routes such as `race/[id]/racebook` can keep a route-local state machine and replace the global bottom bar while focused. The RaceBook bar always exposes exactly Matériel, Dossard, Course, Accès and Services with filled icons, visible labels, app-owned selected colors, safe-area spacing and no exit item. Header back and native system back provide the single exit path and return to the known Courses or Plans origin. Preserve the expanded image-backed identity hero under a strong primary veil, then remove the image for its solid-primary compact state. One 44-point Links action opens the available official website and social destinations. Metrics must remain readable at 100% and 130% text scaling. Course opens on Tracé for every race without persisting a sub-tab across races. Round personal passage and cutoff minutes before formatting, rollover and comparison. Keep ravitos chronological, service icons visibly labeled, numeric formatting localized and the elevation profile margins wide enough for the final tick and cursor label. The last-minute message stays one-line until expanded. Decathlon follows the checklist with generic copy. Keep runner information in its neutral card only when present and retain the normalized emergency number for `tel:` URLs.

- A supporter-only format is also meaningful RaceBook content. Parse the additive supporter collection defensively and use that server/RLS-filtered collection as the mobile sub-tab authority: show it only when a complete point exists, without reapplying the separately cached sponsor-module response. Keep its chronological S-number presentation separate from ravito timing. Align permission chips with the title/distance header, hide an access label that duplicates the point name, and keep the route/external-plan controls icon-only. Directions prefer the organizer Maps URL and fall back to coordinates. Do not attach organizer-authored location or instruction data to analytics.
- A RaceBook may add owner-only plan reflection without personalizing its public snapshot/cache. Once the owner plan is loaded, put its expected duration, duration-based average pace, and resolved departure in the identity hero instead of retaining a second summary card; keep the creation card only while no linked plan exists. The compact passage clock opens the targeted edit without a redundant CTA, segment connectors show plan-derived moving duration, and a late-cutoff warning is disclosure-only. Match personal ravitos by durable `sourceAidStationId` before the strictly legacy normalized name/kilometer fallback. A targeted edit must restore the Livret's current Course sub-tab, and acknowledgement of a newer official revision must save the draft before changing the review timestamp.
- Keep native back labels minimal on dynamic routes so route templates never appear in the header. A RaceBook routes its hero return action and Android hardware back through the same deterministic replacement: Courses after a direct/catalog opening, Plans when the plan workspace supplied that explicit origin.
- Extend the existing `RacebookAccessSection`, `RacebookAidStationsSection` and `RacebookStructuredCourseSections` for their respective presentation blocks instead of growing the route again. Keep data normalization and analytics callbacks in the route, and pass explicit localized copy and the resolved theme into the presentational component.
- Keep the `Tracé` visuals focused and interactive: use `RacebookLeafletMap` and `RacebookElevationProfile`, project ravitos by cumulative kilometer without permanent labels, reveal details only after selection, and provide separate 44-point fullscreen controls. Map ravitos keep a small visible point but must use a larger invisible touch target; their detail prioritizes cumulative distance and D+. Pressing or sliding outside the profile's narrow ravito snap radius must move the cursor and update three cards below the graph with measured cumulative distance, D+ and D-. Entering that narrow radius snaps to the station and temporarily replaces those cards with its details while preserving prominent cumulative distance and D+ values; keep the same exploration available through screen-reader adjustable actions. The full map must keep its close action below the native safe area; the full profile may rotate its canvas to landscape while the application remains portrait-locked, reserve more of the short side for the graph, and keep the same below-graph dynamic content. In that landscape profile, keep the selected ravito in a compact horizontal row aligned with the ordinary cursor metrics and retain its services, cutoff and organizer note rather than hiding secondary details. If the measured GPX/profile is materially shorter than the advertised distance, show that limitation in the inline card instead of stretching the data, scaling cursor totals to the full course, or placing later ravitos at the endpoint.
- Format-specific runner information in the identity card requires both the format access override and its runner-info flag; stored text must remain hidden when either control is off.
- Shared catalog components must accept a nullable D+ from `races`: display `D+ non renseigné`, never coerce it to zero, and disable plan creation until a verified value exists.
- The Racebook publication requirement above applies to ordinary runners, but course discovery is broader: Courses shows preview-selected private formats to every runner for plan creation and removes every masked format (`racebook_preview_is_visible = false`) from cards, counts, deep links, and format sheets. After verifying `race_event_organizers`, a private format additionally receives a dimmed functional RaceBook preview action. The direct screen still verifies membership, and aid stations alone do not unlock it.
- RaceBook sponsors come from the lightweight web API bridge. Start the request and loading-logo warmup from the Courses action before navigation, reuse the short-lived account/race-scoped in-flight request on the destination, and preserve a complete direct-link fallback. Await the actual resolved bootstrap before revealing content; do not substitute a permanent default result merely because a short presentation timeout elapsed. Hold the progress trail at its initial position until that preparation settles so logos are present before visible progress begins. The initial screen groups its localized title, thin unframed-runner progress trail, and one unified sponsor panel closely together. The panel reserves two vertical slots with one divider (roughly one third of the viewport) and disappears if the lookup settles empty. Hide feedback and the bottom navigation only for this state, restore both on completion/unmount, let progress stop below completion while work remains, and visibly reach 100% before replacing the loader. Keep the 2.5-second gate conditional on ready loading sponsors and skip it on pull-to-refresh. Post-load sponsor placements must remain stable and simultaneous: use the subtle unframed partner heading plus compact tiered rows, never a rotating carousel or oversized nested advertising cards.
- RaceBook edition branding travels in that same additive response. Resolve it through `packages/design-system/src/branding.ts`; its shared logo flag must be honored before any prefetch or render. The Pace Yourself fallback pair is forest green `#2D5016` plus alpine blue `#3F6F8F`. Use primary for organizer identity surfaces. Limit accent to the route/profile and ravito visualization; checklist controls, navigation, actions and semantic states remain app-owned. The Material checklist persists owner-scoped item keys by exact race id, updates optimistically, and rolls back failed writes without modifying organizer equipment.
- Relay segments belong in the conditional `Relais` sub-tab of the existing Racebook `Course` tab. Derive them from published relay points instead of creating another route or treating handovers as nutrition stations.
- Keep the Racebook `Services` tab available for every accessible RaceBook. Each populated organizer category stays in its own titled card and renders as plain text without list bullets only while the Services module is effective. Load globally enabled Booking/Decathlon destinations through the narrow web API bridge and validate one HTTPS URL per known partner. Pass Booking to `RacebookServicesSection`; pass Decathlon to `RacebookGearSection`, which renders it after the checklist with non-numeric copy because published equipment does not distinguish purchasable items. Disclose commission beside the relevant action only when the server marks that destination as affiliated, and never send a destination URL to analytics.
- Saved-plan recap/share lives inside the hidden `plan` route group's contextual workspace. Mon plan, Récap, and Paramètres share one canonical draft; entering Récap flushes pending edits before deriving the exact summary, while the legacy summary route redirects into that tab. Register both saved-plan dynamic children with `tabBarStyle: { display: 'none' }`, then retain the focus cleanup as a defensive restoration path. Compose the safe-area-aware contextual navigation with `RacebookTabBar`, supplying only the Plan tabs, Plans exit icon/label and default theme; do not fork its colors, spacing, icon surface or pressed state. That shared contextual bar must mirror the global tab bar's sand background, 60-point content height and Pace Yourself forest active state; contextual icons, labels and destinations are the only intentional differences. The detail header centers its title, frames both back and help in matching 44-point controls at the 16-point gutters, and uses a 184-point expanded body with time/pace/distance above quieter D+/D− values. In the 76-point compact header, keep time and pace as separate side-by-side indicators under the plan name. Mon plan must use one parent vertical scroll: render only the pressed Ravitos/Chronologie/Allures view, then pin one inset rounded surface below the compact header with the three labeled tabs and accessible icon-only auto-fill/add actions on the same row. Preserve the focused ravito when switching views, and do not reintroduce horizontal paging or vertical list scrolls inside the form. Récap reuses that rounded floating surface for its hourly targets and Share action; Paramètres keeps its three cards expanded. List cards use their main surface to open Mon plan and one labelled primary action: Edit before the local race date, Start only on race day, and Recap afterward. Do not expose Start as a secondary action outside race day. Keep the small top-right red trash action separate from the card opener and route it through the existing confirmation; deletion must never delete a canonical course/edition unlock. Total time must reuse the saved-plan section calculation, including pauses, terrain, fatigue, and custom segment pacing; never introduce a list-only `distance / speed` estimate. A list-level Share shortcut should build the same saved recap and open the native share sheet in place; when no reliable departure exists, explain the missing input and route to Récap. A manually selected departure time remains a per-plan local preference. Once recap data and departure time are ready, synchronize the public snapshot through `apps/mobile/lib/planShareLinks.ts` so an existing stable URL immediately reflects regenerated values; explicit native share must reuse the same deduplicated request/result. Do not put service-role behavior in mobile code. Preserve per-checkpoint assistance availability in the generated snapshot.
- A locked saved plan keeps the same Mon plan, Récap, and Paramètres navigation instead of diverting to a standalone paywall. The free workspace lets runners browse Ravitos/Chronologie/Allures and see genuine aggregate needs; paid details are represented only by non-accessible decorative placeholders with contextual unlock copy. Never mount paid editors, product controls or hidden actionable content beneath the overlay. Historical detail access may continue to render the real Récap read-only, while every editing affordance remains gated.
- The solid plan-workspace header mounts light system-status icons. Its D− metric uses the linked race's official value when available so it agrees with the Livret coureur, with profile-derived descent only as the legacy/unlinked fallback; neither display path changes planner persistence or timing calculations.
- Dense setup screens can collapse secondary controls by default when the collapsed state still shows the key values needed to understand the current configuration.
- Keep free-training setup/session orchestration in its route, while the active-session rendering stays in `components/race/TrainingLiveSession.tsx`; that presentation component consumes computed live state and must not duplicate nutrition or alert scheduling rules.
- Keep only Plan profile setup inside the hidden onboarding shell. Course, product, plan, and RaceBook guidance must route through their real screens with the localized `OnboardingGuideCard` and ordinary tab navigation.
- Persist each tour independently as pending, in-progress, skipped, or completed. Local progress may resume a stage, but the Profile notification dot must use the durable profile statuses.
- Keep guided-route behavior behind an explicit `onboarding` parameter. Normal Courses, Nutrition, plan creation, and RaceBook behavior must remain unchanged when it is absent.
- Guided RaceBook discovery must require a deliberate two-character search, reuse the ordinary `canShowRacebook` publication/content gate, remove the competing plan action, and track search/event/format selection without sending the search text.
- When a mobile screen embeds public formats under `race_events`, use an explicit live-format relation filter; use `!inner` when parent events with no visible formats must also disappear. RLS/public flags alone do not filter the embedded array in this schema.
- When extending the Courses tab, preserve its event-level route contract: favorites stay tied to `race_events`; an identified runner's card-local heart may flip in the same interaction frame and animate optimistically, but it must resynchronize with the server result and preserve the current list order and viewport until the next load or refresh applies the confirmed pinned order; a guest heart must open the account prompt without flipping. Organizer-update links add `updateId` and optional `raceId` to the catalog route so the existing event sheet opens the precise message and format context; the light-green update panel follows every format action, shows only the newest or targeted message while collapsed, and reveals older messages plus lazy-loaded history through `View more`.
- Premium purchase UI that can trigger App Store review should keep the subscription summary plus both legal links close to the CTA: explicit title, duration, price, privacy policy, and Terms of Use (EULA).
- Native changes require a new platform-compatible EAS Update runtime. The current source uses store marketing version `1.1.2` and shared runtime `1.1.2`; production Android and iOS build 18 both embed that runtime.

### Racebook Identity Presentation

The expanded identity hero displays the formatted course date beneath the race name, not the event date range. Keep date, location and participation as compact icon-led metadata, and place the heading beside the back action. Its collapsed state keeps the back action, title and one Links control on a solid-primary surface without duplicating a native header. Keep the emergency call action separate and retain the normalized number for the `tel:` URL.

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
    The RaceBook Material checklist follows the same outcome rule for toggles: emit only after persistence succeeds. Its organizer reporting snapshot may emit one bounded event per published item after a non-empty load or settled successful interaction, but must keep persistence keys, notes, aggregate checked totals, and untouched empty checklists private.
12. For a new root tab, use `RootCollapsibleHeader`; place at most one essential persistent action in it. Put additional genuine contextual actions in `RootScreenActionMenu`, and omit that menu when it would contain only static help copy or duplicate another primary journey.
13. For a new hidden child screen under an existing stack, register the explicit child route in `apps/mobile/app/(app)/_layout.tsx` and give it a localized title in the stack layout for that feature area.
14. When the screen belongs to a critical user journey, add stable, semantic `testID` hooks to the smallest actionable elements and extend `apps/mobile/.maestro/flows/authenticated-shell.yaml` or add a focused flow. Do not target translated copy when a stable id is available.

## Validation

For a runner launch announcement, test its state model without assuming device visual proof: only an authenticated launch-cohort member within the server's seven-day window can show it after bootstrap/launch/onboarding transitions on root tabs. A cached session plus user-scoped endpoint refresh adds no Auth listener; session, endpoint or storage failures show nothing. Presentation records one `seen` marker per user/device/campaign, including migration from older daily/hidden preferences. Verify no auth/onboarding/editor/live/purchase route shows it, and that its close action plus Plans navigation cannot alter plan/Premium/trial/grant rights.

For the Profile admin-only 1.0 preview control, verify it is shown only for trusted Auth-admin presentation, opens and closes with local screen state, and cannot invoke the campaign hook, consume/write a marker, consult the rollout flag, or change access. It is a visual preview, not an announcement-delivery test.

Launch cohort badge/popup and support-offer presentation must remain cosmetic/informational until a user explicitly enters a separately verified support purchase flow. They cannot create a plan unlock or change an existing subscription/trial/grant.

For the locked mobile preview, verify without claiming native blur unless implemented: departure and its first following section are clear; later real cards are visible, scrollable, non-interactive, and hidden from accessibility; no automatic popup occurs. Test visible sample edit/add/split and auto-fill actions plus inline/sticky CTA all open the same paywall and do not mutate a plan. Verify plan-specific paywall offer ordering and normalized organizer start time in expanded/compact hero/header.

For paywall and long-loading changes, verify French and English copy, the exact contextual placement, provider-price loading/error/retry states, annual renewal disclosure, restore and legal links. A plan loading surface must always provide an exit; the editor timeout must expose Retry and reject any late stale response.

For a locked runner-plan preview, smoke-test the clear departure/first section and scrollable later real cards: later content must be non-interactive and accessibility-hidden, but there is no cutoff or automatic popup. Verify only one full CTA card is actionable at a time while its inline/centered handoff does not jump the scroll; title, description and button remain present when centered. Preview actions must open the same central paywall without autosaving, mutating supplies or creating another plan; paid access restores the existing full workflow. Check `RaceWorkspaceSwitch` below both heroes in expanded and compact states, including safe-area insets.

For the centered unlock overlay, use real viewport/section/inline/fixed-tab measurements and clamp the card on small screens. During scroll, one compact CTA remains centered in the useful area below headers/tabs and above the scroll bottom; it returns inline at the top. Verify the free recap exposes only total estimated time, average pace, and public passage names/distances without paid times; both recap CTAs open the existing paywall without a write or public share.

Also test a short course: the compact CTA threshold must still be reachable from measured viewport, inline and fixed-tab geometry. Preview-only trailing space may appear only after ghost cards; it must not change paid layout. Switch plans in the same session and verify prior measurements are not reused.

For Courses visibility work, verify both roles across all three states: runners never see masked formats, see private formats with plan creation but no RaceBook action, and see public formats normally; active organizers also see no masked formats, see private formats with a dimmed functional RaceBook action, and see public formats normally. Keep the organizer merge bounded by membership event ids, filter masked rows after merging, and deduplicate stable race ids. Also cover both date boundaries: non-favorites disappear after their event date while favorites remain through day 14 and disappear on day 15; when a newer edition is online, the older edition remains through day 14 after its latest visible format date and only the newer edition remains on day 15. Preserve legacy or malformed rows whose edition boundary cannot be established.

Run typecheck/test where available:

```bash
npm run typecheck
npm run test
```

For native behavior, build/run with the development client profile from `apps/mobile/eas.json`. That profile sets `APP_VARIANT=development` and installs as `Pace Yourself Dev` (`com.paceyourself.app.dev`) beside production. Set the same variable before starting Expo locally; in PowerShell, run `$env:APP_VARIANT = "development"` before `npm run dev:mobile`.

For store-review behavior, unit-test the pure policy and smoke-test both production-platform binaries. Development builds intentionally skip the request. A returning identified account with a saved plan becomes eligible from its second recorded foreground session, but platform quotas mean a successful native request does not prove that the dialog appeared.

Before promoting an Android store candidate, smoke-test the release build from the internal track as well as the development client. Release variants enable R8 minification and resource shrinking, so development-client success alone cannot detect a missing keep rule or reflection-only native path removed by optimization. Preserve the candidate's own `mapping.txt` for any obfuscated native crash.

For the cross-platform authenticated shell audit, follow [Mobile UX Audit](mobile-ux-audit.md). Run `npm run test:e2e:ux -w @trailplanner/mobile` locally when Maestro and an installed build are available, or launch the manual EAS workflow.

For production OTA updates, resolve and verify runtime `1.1.2` on both platforms. Publish only a commit already validated on the development OTA channel and only after matching production binaries exist.

For the native iOS build prompt, keep release metadata separate from ordinary screen copy. `NativeBuildUpdatePrompt` reads the installed native build and the OTA-visible `nativeBuildUpdates.ios` marker, stays disabled in development and on non-iOS platforms, and reuses the shared actionable toast above the safe-area-aware tab bar. Increase the marker only after the build is installable. Use the production workflow's optional legacy iOS runtime input only when the exact JavaScript bundle is compatible with that older native bridge.

Before starting a store build, compare the explicit app marketing `version` with the latest approved store version. The production profile auto-increments developer-facing build identifiers only; a closed App Store version train requires a higher `version` and a newly built IPA.

For App Store subscription work, verify on iPhone and iPad layouts that the purchase surface still exposes functional privacy and Terms/EULA links without truncation.

## Analytics Gotchas

- Reuse the Courses `catalog create plan clicked` boundary for enabled catalog plan actions. It records click intent before navigation; successful persistence remains the responsibility of the later `plan created` event.

## Do Not

- Do not assume Expo Go can test screens that depend on native modules.
- Do not paste PostHog keys or Supabase keys into source/docs.
- Do not bypass RevenueCat/subscription sync for premium screens.
- Do not replace a locked plan workspace with a dead-end preview screen. Preserve navigation and free calculated context, then gate each paid modification area with one clear contextual unlock action.
- Do not call service-role-only web routes from the mobile client.
- Do not add one-off global session effects inside a screen; keep them in `_layout.tsx` or a dedicated helper with idempotency guards.
- Do not render Google sign-in on iOS builds. Use the shared auth hooks so provider availability stays platform-specific.
- Do not add `@react-native-google-signin/google-signin` back into `apps/mobile/app.config.ts` for iOS-only URL-scheme convenience; in this app, iOS must stay on the browser OAuth path unless the full native iOS integration is intentionally restored.
- Do not use React Native's raw `Text` for normal app UI; it bypasses the shared Bricolage Grotesque and JetBrains Mono typography.
- Do not add a native title above the shared collapsible root header.
- Do not put root-tab help or feedback into the collapsible header. Keep one persistent primary action there and use the floating root action menu for secondary contextual actions.
- Do not remove the opened menu backdrop or high-contrast action styling unless replacing it with an equally readable treatment across busy root screens.
- Do not expose temporary flows like free training as new bottom tabs unless they become primary navigation destinations.
- Do not rely on a hidden parent route to hide every nested Expo Router screen. Register important dynamic children explicitly when adding plan/race utility screens, and choose separately whether the tab bar itself remains visible.
- Do not switch the tab shell back to `backBehavior: 'initialRoute'` for hidden child flows unless you explicitly want Android hardware back to jump to the default tab instead of the previous screen. Keep route-specific exceptions, such as RaceBook's deterministic Courses/Plans return, local to that route.
- Do not replace the inset-aware visible tab bar sizing with a fixed height; Android system navigation modes reserve different bottom areas.
- Do not hide subscription legal links in a distant settings screen when the active surface is an in-app paywall; premium upgrade prompts should expose privacy and Terms/EULA directly.
- Do not publish an OTA across incompatible native runtimes. The current release line uses `1.1.2` on both platforms; older `1.1.1` and `1.1.0` binaries must remain isolated from its updates.
- Do not apply organizer accent colors to semantic status UI or expose an unpublished branding draft through a mobile screen.
- Do not store test credentials in a flow, snapshot, source file, or public Expo environment variable.
- Do not use the legacy runner race new/edit routes as authoring examples; they are redirect-only compatibility routes and plan creation starts from Courses.

Shared plan/catalog UX must preserve the existing routes and `testID` values. Current plan-flow expectations include a 44-point minimum for audited steppers/icon actions, hidden accessibility-only skeleton decoration, a clear-search action, compact no-image race cards, and a contextual plan header that may show the parent event below the format name.
Equivalent mobile controls must reuse `mobileComponents`: 16-point first-level gutters, full-radius filter chips, common segmented selectors, one bordered input shell with inline units/clear actions, 44-point modal closes, and a shared button radius.

## Shared launch-polish primitives

Prefer the shared brief toast for non-destructive feedback, the existing empty state for no-content screens, and the delayed skeleton pattern for short initial reads. Root headers receive shadow only after scroll; tab bars retain their subtle top divider. Decorative haptics must no-op on web and with reduced motion.

## Related Docs

Mobile RaceBook entry points must pass preview selection plus publication/organizer access through `canShowRacebook`; screens must not recreate those gates locally.

RaceBook GPX cards must also honor normalized `gpxDisplay` route/profile choices independently, with both visuals visible when the historical payload omits the preference object.

- [Mobile App](../01-architecture/mobile-app.md)
- [Premium Entitlement](../03-business-rules/premium-entitlement.md)
- [Analytics](../05-integrations/analytics.md)
- [Design Components](../07-design-system/components.md)

## Race workspace presentation checks

For RaceBook or plan-workspace changes, verify two-line hero titles at 100% and 130% text scaling, 44-point increment/decrement targets, content clearance below sticky selectors, localized distance/range/clock output, and image-error fallback without an empty rail. Keep the Livret/Plan switch as the sole plan entry control on RaceBook; a saved plan may show a revision warning, but must not add a duplicate creation card.
