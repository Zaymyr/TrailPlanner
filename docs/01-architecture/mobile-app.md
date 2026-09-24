---
title: Mobile App Architecture
scope: architecture
last_verified: 2026-09-24
ai_priority: high
related_files:
  - apps/mobile/lib/racebook.ts
  - apps/mobile/lib/raceProfile.ts
  - apps/mobile/locales/fr.ts
  - apps/mobile/locales/en.ts
  - apps/mobile/locales/types.ts
  - apps/mobile/package.json
  - apps/mobile/vitest.config.ts
  - apps/mobile/lib/shared.ts
  - apps/mobile/lib/shared.test.ts
  - apps/mobile/lib/racebookSponsorPresentation.test.ts
  - apps/mobile/lib/racebookBranding.test.ts
  - apps/mobile/.eslintrc.js
  - apps/mobile/react-native.config.js
  - apps/mobile/app.config.ts
  - apps/mobile/eas.json
  - apps/mobile/.eas/workflows/mobile-ux-audit.yml
  - apps/mobile/.maestro/config.yaml
  - apps/mobile/.maestro/flows/authenticated-shell.yaml
  - apps/mobile/scripts/run-mobile-ux-audit.mjs
  - apps/mobile/app/_layout.tsx
  - apps/mobile/app/(app)/_layout.tsx
  - apps/mobile/components/navigation/AppHeaderTitle.tsx
  - apps/mobile/components/PlanLoadingScreen.tsx
  - apps/mobile/components/inputs/NumericKeyboardAccessory.tsx
  - apps/mobile/app/(app)/catalog.tsx
  - apps/mobile/components/catalog/CatalogPresentation.tsx
  - apps/web/lib/mobile-racebook-onboarding.test.ts
  - supabase/migrations/20260911114106_expose_private_formats_in_visible_catalog.sql
  - supabase/migrations/20260923070437_separate_web_and_mobile_race_visibility.sql
  - apps/mobile/app/(app)/profile.tsx
  - apps/mobile/app/(app)/onboarding.tsx
  - apps/mobile/components/onboarding/OnboardingIntroSteps.tsx
  - apps/mobile/components/onboarding/OnboardingProfileSteps.tsx
  - apps/mobile/components/onboarding/OnboardingProductChoice.tsx
  - apps/mobile/components/onboarding/OnboardingRaceSelectionStep.tsx
  - apps/mobile/components/onboarding/OnboardingNutritionProductsStep.tsx
  - apps/mobile/lib/onboardingGate.ts
  - apps/mobile/lib/onboardingStatus.ts
  - apps/mobile/lib/onboardingStatusCore.ts
  - apps/mobile/components/onboarding/OnboardingGuideCard.tsx
  - apps/mobile/components/profile/ProfileOnboardingSection.tsx
  - apps/mobile/app/(app)/race/_layout.tsx
  - apps/mobile/app/(app)/race/_race-screen-v2.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/components/racebook/RacebookAccessSection.tsx
  - apps/mobile/components/racebook/RacebookAidStationsSection.tsx
  - apps/mobile/components/racebook/RacebookBibSection.tsx
  - apps/mobile/components/racebook/RacebookGearSection.tsx
  - apps/mobile/components/racebook/RacebookServicesSection.tsx
  - apps/mobile/components/racebook/RacebookStructuredCourseSections.tsx
  - apps/mobile/components/premium/PremiumUpsellModal.tsx
  - apps/mobile/components/profile/ProfileLanguageSection.tsx
  - apps/mobile/components/profile/ProfilePremiumSection.tsx
  - apps/mobile/components/race/GpxImportPreviewModal.tsx
  - apps/mobile/components/race/GpxRoutePreviewCard.tsx
  - apps/mobile/components/race/RacebookLeafletMap.tsx
  - apps/mobile/components/racebook/RacebookSponsorExperience.tsx
  - apps/mobile/components/racebook/RacebookCollapsibleHero.tsx
  - apps/mobile/components/racebook/RacebookTabBar.tsx
  - apps/mobile/components/plan-form/ProfileMiniChart.tsx
  - packages/design-system/src/branding.ts
  - apps/mobile/components/race/RaceEventSummaryCard.tsx
  - apps/mobile/lib/gpx.ts
  - apps/mobile/hooks/usePremium.ts
  - apps/mobile/hooks/useSessionSideEffects.ts
  - apps/mobile/hooks/useProfileScreen.ts
  - apps/mobile/hooks/useGuestAccountPrompt.ts
  - apps/mobile/hooks/usePlansScreen.ts
  - apps/mobile/app/(app)/plans.tsx
  - apps/mobile/lib/plansScreenBootstrap.ts
  - apps/mobile/components/plans/PlansList.tsx
  - apps/mobile/components/plans/plansHelpers.ts
  - apps/mobile/components/plans/types.ts
  - apps/mobile/app/(app)/plan/new.tsx
  - apps/mobile/hooks/profileScreenHelpers.ts
  - apps/mobile/lib/race-import.ts
  - apps/mobile/lib/racebookOnboarding.ts
  - apps/mobile/lib/racebookSponsors.ts
  - apps/mobile/lib/fetchWithTimeout.ts
  - apps/mobile/lib/racebookSponsorPresentation.ts
  - apps/mobile/lib/resendContactSync.ts
  - apps/mobile/lib/resendContactSync.test.ts
  - apps/mobile/lib/planShareLinks.ts
  - apps/mobile/lib/planShareLinks.test.ts
  - apps/mobile/lib/planDeparture.ts
  - apps/mobile/lib/planDeparture.test.ts
  - apps/mobile/lib/webApi.ts
  - apps/mobile/lib/posthog.ts
related_tables:
  - races
  - race_events
  - plan_share_links
  - subscriptions
  - user_profiles
  - push_devices
  - race_event_updates
  - race_event_update_reads
  - race_relay_points
  - race_event_edition_sponsors
  - race_event_edition_branding
---

# Mobile App Architecture

## Plan list hierarchy

The mobile Plans screen groups saved plans by `races.race_events.id` and displays the event name as the section heading. Plans for different formats of the same event therefore remain together; legacy or private races without an event fall back to a race-level section. The optional organizer edit action is only shown when every plan in the section points to the same editable race. Within an event section, default plan names matching the race format omit the repeated event name whether it precedes or follows the format; an exact duplicate becomes the neutral localized label “Plan de course” / “Race plan”, while runner-defined names remain unchanged. Event headings use stronger typography and plan cards are slightly indented to make the parent-child hierarchy explicit. Ravito counters exclude the editor-only start and finish stations, including for legacy rows that persisted them.

## Plan loading experience

The Plans list, plan creation, editing, recap, onboarding handoff, and live-mode preparation share `PlanLoadingScreen`. These operations combine network requests, local reads, entitlement checks, and synchronous calculations, so their percentage values are milestones rather than measurable elapsed progress. The UI must not expose a determinate progress bar or percentage: it uses an indeterminate branded trail animation, a context-specific title, the plan name once, and plain-language phase copy. Creation, editor, and recap routes also set their header while loading so a previous screen title or action cannot remain visible during navigation. When a load lasts longer than six seconds, a neutral reassurance appears without blaming the connection or promising a completion time. The component respects the system reduce-motion preference and exposes the active status as a polite busy accessibility announcement.

## Structured RaceBook modules

RaceBook loads its core race, ravito/product, relay, SAS, awards, and edition-services snapshot through one public-first web API request. The API can serve a shared CDN copy for published RaceBooks and mobile retries with the session token only when an organizer preview requires it; the former direct Supabase reads remain a compatibility fallback. Course shows conditional **SAS** and **Podiums** views. Services render as actionable cards; per category, structured rows take precedence over legacy text. Approximate distance uses start-address coordinates, then GPX start, then format/event coordinates, and is hidden when either endpoint is invalid. Google Maps remains responsible for the real itinerary.

These three normalized collections are additive reads. If one table is temporarily unavailable during a staggered database/app rollout, mobile records a bounded warning and treats that collection as empty; it continues rendering an otherwise valid legacy RaceBook. Core race, organizer-detail, ravito and relay failures still keep the unavailable state.

RaceBook sponsor presentation is isolated in `RacebookSponsorExperience.tsx`: resilient edition logos, progressive loading, sponsor links, and the stable themed partner surface remain UI concerns, while the route owns loading state and sponsor selection. `SponsorBanner` accepts a `hero` or contextual placement plus an aggregate-only impression callback, so ravitos, equipment, access, and services can compose a matching sponsor surface without coupling to the route layout. Official partners use a compact three-column logo grid; the larger horizontal treatments remain reserved for principal and service partners.

## Purpose

The mobile app is the Expo Router client for onboarding, catalog browsing, plan creation, GPX import, premium state, push registration, and mobile analytics. Read this before changing native flows or EAS build assumptions.

## Key Concepts

- Expo Router: route files under `apps/mobile/app`.
- Development client: EAS development profile with `expo-dev-client`.
- App session: Supabase session synchronized into mobile helpers.
- RevenueCat: native in-app purchase source that syncs into Supabase subscriptions.
- Web API bridge: mobile calls selected Next.js API routes for operations that need server keys.
- Resend contact sync: mobile calls the web API bridge after identified, non-anonymous sessions; the Resend key remains server-side, while the local successful-sync marker uses a SecureStore-safe user/email digest key.
- Plan share links: mobile sends an authenticated recap snapshot to the web API, which creates the public crew URL server-side.
- Event favorites: identified runners can favorite `race_events`, pin them to the top of the Courses tab, and receive organizer update pushes for those events. Guest runners keep the visible heart affordance, but pressing it opens the shared account creation/sign-in prompt without writing a favorite.

## Framework Setup

`apps/mobile/package.json` declares:

- `expo ~54.0.37`
- `expo-router ~6.0.24`
- `react 19.1.0`
- `react-native 0.81.5`
- `@supabase/supabase-js ^2.45.4`
- `expo-dev-client ~6.0.20`
- `expo-crypto ~15.0.8`
- `expo-updates ~29.0.20`
- `@react-native-google-signin/google-signin ^16.1.2` for Android native Google Sign-In only
- `react-native-purchases ^9.15.1`
- `posthog-react-native ^4.45.0`
- `react-native-webview 13.15.0` for the interactive Racebook Leaflet map
- `test` / `test:watch`, which run the fast Node-only Vitest suite for pure mobile logic
- `test:e2e:ux`, which invokes the local Maestro UX journey without storing credentials in source control
- `lint`, which runs the Expo-compatible ESLint rules while excluding generated export directories; `eslint-plugin-react-hooks` is a direct development dependency so clean workspace installs do not depend on npm hoisting it transitively

The mobile Vitest configuration resolves React explicitly from `apps/mobile/node_modules`. It imports Node's `URL` implementation alongside `fileURLToPath` so the alias remains type-safe when DOM and Node URL declarations coexist. This preserves the React 19 mobile runtime when tests traverse the source-exported design-system package instead of falling back to the root web runtime or constructing a non-existent `apps/mobile/react` path.

The root layout imports only the nine Bricolage Grotesque and JetBrains Mono weight subpaths registered in `useFonts`. Importing from each font package root makes Metro retain unused weights and italics in the production asset graph.

The app config in `apps/mobile/app.config.ts` declares:

- production app name `Pace Yourself` and development-variant name `Pace Yourself Dev`;
- slug `pace-yourself-app`;
- owner `pace-yourself`;
- scheme `paceyourself`;
- production Android/iOS identifier `com.paceyourself.app` and development identifier `com.paceyourself.app.dev`, selected by `APP_VARIANT=development`;
- app version `1.1.1`;
- shared iOS/Android runtime version `1.1.1` for the current native release line;
- light system appearance, matching the app's light palette and dark status-bar content;
- EAS project id `c713a8a0-cd94-4f6e-9468-063c9c20da6c`;
- update URL `https://u.expo.dev/c713a8a0-cd94-4f6e-9468-063c9c20da6c`.

Expo SDK 54 and React Native 0.81 compile against and target Android 16 / API 36. The project relies on those SDK defaults rather than adding a redundant `expo-build-properties` override.

`apps/mobile/package.json` excludes `@react-native-google-signin/google-signin` from Expo iOS autolinking, `apps/mobile/react-native.config.js` disables the package for iOS in the React Native community autolinking layer, and `apps/mobile/app.config.ts` does not register the package's Expo config plugin. Native Google Sign-In is Android-only in `apps/mobile/hooks/useGoogleAuth.ts`, while iOS uses the browser OAuth path; keeping the package out of the iOS native build avoids both the Swift `AppCheckCore` CocoaPods conflict on EAS and Fabric startup crashes from partially registered Google Sign-In native components.

## EAS Profiles

`apps/mobile/eas.json` defines:

- `development`: internal distribution, `developmentClient: true`, and `APP_VARIANT=development`, so it installs as `Pace Yourself Dev` beside production.
- `preview`: internal distribution, Android APK, iOS Release.
- `e2e-test`: unsigned Android APK and iOS Simulator build used only by Maestro.
- `production`: Android app bundle, iOS Release, auto-increment enabled.
- `submit.production.android`: completed release on the Google Play `production` track.
- `submit.production.ios.ascAppId`: App Store Connect app id `6772180071` for TestFlight submissions.

Because the dependency set includes native modules such as `expo-dev-client`, `react-native-purchases`, notifications, secure store, Apple auth, and `expo-crypto`, use the development client profile for realistic local/device testing. Expo Go can only be assumed for flows that do not require these native modules.

The manual EAS workflow at `apps/mobile/.eas/workflows/mobile-ux-audit.yml` is the versioned cross-platform target: it builds Android and iOS in parallel, runs the authenticated Maestro journey with one retry, records each platform, and retains its screenshots as test artifacts. Hosted Maestro jobs require a compatible paid Expo plan; the current project plan rejects those jobs, so local Android execution remains the immediately available path. The journey covers login plus the Courses, Plans, Nutrition, and Profile tabs. Its app id defaults to the E2E/production identifier with a clean restart and login deep link. Local physical-device audits explicitly open the Dev login route through ADB, pass `APP_ID=com.paceyourself.app.dev`, preserve app state and the active Metro process, and skip the shared-scheme deep link so they cannot target the installed production app. Stable React Native test ids are used instead of translated labels. `MAESTRO_E2E_EMAIL` and `MAESTRO_E2E_PASSWORD` must be secret variables in the EAS `preview` environment; they are never committed or exposed as Expo public values.

## App Shell

`apps/mobile/app/_layout.tsx` initializes:

- global error handling;
- fonts and splash handling;
- Expo Updates startup and foreground checks;
- Supabase auth state listeners;
- trial status initialization;
- premium state gating through `usePremium`;
- PostHog provider;
- push registration once a session is active;
- Resend contact sync once an identified, non-anonymous session is active.

`apps/mobile/hooks/useSessionSideEffects.ts` owns the session-bound trial refresh, identified-user Resend sync, and pending account/guest conversion finalization. It deliberately does not own session navigation, PostHog identity/reset, or push registration, which remain coordinated by the root layout.

The layout also tracks auth analytics for signed-in and signed-out events.
It keeps the system status bar dark because the application surfaces are light; changing this appearance configuration requires a compatible native iOS build.
Cold-start and post-auth navigation resolves the mobile onboarding statuses first, then opens either the initial chooser, a persisted in-progress stage, or the Courses catalog.
The initial chooser is skippable and offers independent Plan and RaceBook tours. Plan setup remains a hidden non-tab flow, then hands off to the real Courses, Nutrition, plan creation, and editor screens. RaceBook uses the real Courses catalog and published RaceBook screen. In the guided RaceBook mode, the catalog immediately lists events with an ordinarily accessible published RaceBook and also lets the runner narrow that list by searching. It exposes only the RaceBook action so selecting a course cannot divert into plan creation. Those real screens keep normal tab navigation and add a non-blocking guide card. `user_profiles.plan_onboarding_status` and `racebook_onboarding_status` distinguish pending, in-progress, skipped, and completed states; local AsyncStorage retains the current stage/race for cold-start resumption.
The shared onboarding shell, initial tour chooser, overview, workflow explanation, and completion summary are presentational components in `apps/mobile/components/onboarding/OnboardingIntroSteps.tsx`. Personal details, performance inputs, and nutrition targets live in `OnboardingProfileSteps.tsx`. Course search, personal GPX import presentation, event-format selection, and its format sheet live in `OnboardingRaceSelectionStep.tsx`; searchable brand/product selection lives in `OnboardingNutritionProductsStep.tsx`, with each product row delegated to `OnboardingProductChoice.tsx`. The route remains responsible for state, validation, loading, persistence, authentication callbacks, analytics, and navigation; extracted onboarding components must stay free of session and Supabase side effects.
Profile Settings exposes both tours with their statuses. Its tab icon shows a notification dot until both are completed; skipped tours intentionally keep the dot visible. Replaying a completed tour does not downgrade its durable status.
On cold start and after authentication, sessions that do not require onboarding open on the `catalog` Courses tab by default. The tab shell in `apps/mobile/app/(app)/_layout.tsx` also registers hidden detail routes such as `race/[id]/racebook` explicitly so Expo Router does not surface them as bottom-tab destinations while keeping normal pushed navigation behavior. The tabs use history-based back behavior so Android hardware back returns to the actual previous screen instead of snapping to the default `catalog` tab when a hidden detail route was pushed.
The visible bottom tab bar orders its primary destinations as Courses, Plans, Nutrition, then Profile. It derives its bottom padding and total height from `react-native-safe-area-context`, keeping all four actions above Android's three-button navigation area while preserving the existing minimum spacing on gesture-navigation devices and iOS. While a loaded RaceBook is focused, this global bar is replaced by an inset-aware contextual bar for its available sections plus an explicit Courses exit; leaving the route restores the global navigation. The contextual bar deliberately mirrors the global bar's filled Ionicons and color-only selected state instead of placing active icons on an additional colored tile.
The login route follows the signup scroll/keyboard-avoidance pattern so its password, account-creation, and platform sign-in actions remain reachable on compact iPhones and at enlarged text sizes. Profile keeps its runner onboarding shortcuts in Settings rather than inside personal identity fields, and its save action is enabled only while persisted profile fields have changed. Modal sheets isolate VoiceOver focus with `accessibilityViewIsModal`, identify their titles as headers, and give icon-only dismiss actions an explicit label and at least a 44-point touch target or equivalent hit slop.
Numeric, decimal, and pace inputs attach to the shared iOS `NumericKeyboardAccessory`, which exposes a visible `Terminé` action because those native keyboards do not provide a return key. The accessory is mounted once by the authenticated app shell and is inert on Android.
The four visible tab actions expose stable `nav-tab-*` test ids for cross-locale Maestro navigation. These ids are test hooks only and do not alter labels, routing, or accessibility state. Their shared floating root menu uses an ellipsis rather than a plus because it mixes contextual creation with help and feedback actions.
Plans use the main card surface to open or edit a plan and expose a dedicated management sheet after a 550 ms long press, including an equivalent screen-reader long-press action and contextual help copy. The sheet contains a focused editable name, a save action, and a delete action that still requires native confirmation; successful renames update only the plan name and timestamp, invalidate any stale local edit draft, and keep anonymous reminder copy aligned. Each card splits its summary into compact Total time, Ravitos, and Departure countdown cells. Total time is generated by the same canonical section calculation as editor highlights, recap, sharing, and live mode: it includes terrain, fatigue, stored segment adjustments, and aid-station pauses instead of recomputing `distance / speed`. The countdown stays live in `J H Min S` when a dated departure is available. Departure resolution gives priority to the runner's per-plan local override, then a safely normalized single organizer schedule value, then the first configured start wave; ambiguous legacy multi-time strings are not collapsed into one departure. Recap, team-share, and start/resume remain icon-only actions in a compact right-side rail with localized accessibility labels. Active state is a small title badge, section headers expose their expanded state with a chevron, and the training shortcut stays visually secondary. The list-level share action builds the saved recap and invokes the native crew-link share in place, without opening the recap first; if no reliable departure exists, it explicitly sends the runner to the recap to enter one. Nutrition distinguishes taller collapsible brand headers from indented product cards, uses a larger official product image as the brand thumbnail when available, and keeps the tag icon as fallback while grouping unrecognized product names under the localized fallback. Product cards use the same heart vocabulary as Courses and keep carbs, sodium, and calories on one compact line.
Organizer update pushes deep-link into the catalog with `eventId`, `updateId`, and an optional `raceId`. The catalog reopens the event sheet, loads an older targeted message when it is outside the preview, places that message first, and highlights the concerned format.
French inactivity and unfinished-plan notifications come from `apps/mobile/locales/fr.ts`; their titles use typographic apostrophes and must stay aligned with the server-side reminder copy.
Shared hidden-screen headers use `apps/mobile/components/navigation/AppHeaderTitle.tsx` with explicit title-container insets from `apps/mobile/app/(app)/_layout.tsx`. When a screen adds extra header actions, keep enough right inset for those icons so long French titles truncate cleanly instead of overlapping the header buttons on narrow iPhones.
Race detail stacks use minimal iOS back indicators so dynamic route segments such as `[id]/racebook` are never exposed as user-facing copy. RaceBook's back action first follows usable navigation history and otherwise replaces the route with the Courses catalog, so both pushed and direct openings remain escapable.

## Catalog and Event Sheets

`apps/mobile/app/(app)/catalog.tsx` is now the runner surface for event favorites and organizer announcements:

Its reusable loading card, race row, personal-race section, and filter modal live in `apps/mobile/components/catalog/CatalogPresentation.tsx`; the route retains catalog queries, filtering state, favorites, analytics, and navigation.

- its public event relation uses an inner join filtered to `races.racebook_preview_is_visible = true`, so an event remains discoverable with private formats but no public RaceBook; the presentation filter removes every format whose preview flag is false;
- masked formats are absent from the mobile catalog for runners and organizers; private formats remain listed for every runner and support plan creation, but only active event organizers receive the lightly dimmed RaceBook preview action; public formats use the normal runner presentation;
- it loads favorited `race_events` for identified, non-anonymous users through the web API bridge;
- it pins favorite events above the normal date/name ordering when the catalog is loaded or refreshed; for identified runners, the card-local heart state flips in the same interaction frame with a reduced-motion-aware pulse, then resynchronizes with the parent/server state while preserving the current list order and viewport; the next refresh applies the new pinned order;
- it reuses `RaceEventSummaryCard.tsx` for the event row and exposes the same favorite toggle inside the event sheet;
- catalog formats accept a nullable published D+: cards and sheets render `D+ non renseigné` instead of coercing the absence to zero, and plan creation stays disabled until a real D+ is supplied;
- its multi-format event cards omit the repeated “choose a format” helper sentence because the format-count pill and compact action already communicate the next step; the action shares the same row as the count and distance pills, the complete card opens format selection, the race image fills the left rail, and the independent animated heart occupies the compact trailing header position; onboarding may keep the guidance in the same shared component and the former decorative flag stays omitted;
- beside the advanced filter action, horizontal quick filters expose favorites and the `< 30 km`, `30–60 km`, and `60+ km` distance bands without changing the loaded catalog or its database query;
- its guided RaceBook mode immediately lists only events containing an ordinarily accessible published RaceBook, lets the runner browse or search that list, and removes the competing plan action from the format sheet;
- it preloads up to three recent manual organizer updates per live event, renders only the newest (or deep-link-targeted) announcement after every format row inside one light-green panel, and reveals the other messages plus fuller history only when the runner taps `View more`;
- it reads `eventId`, `updateId`, and optional `raceId` route params so a push opens the matching event, message, and format context directly;
- it loads the identified runner's `race_event_update_reads` plus lightweight update id/event references, displays `NEW` on event cards even when the unread item is older than the three-message preview, and persists receipts after messages are displayed.

## Premium and Purchases

`apps/mobile/hooks/usePremium.ts` combines several signals:

- profile trial fields from `user_profiles`;
- web/API entitlements from `/api/entitlements`;
- `subscriptions` rows;
- active `premium_grants`;
- RevenueCat customer info.

All `usePremium()` consumers subscribe to one module-level monitor. Auth, foreground, purchase, and RevenueCat signals are coalesced into a single refresh queue, so mounting several screens does not duplicate the Supabase/API reads or native listeners. State snapshots are emitted only when an entitlement field changes.

When RevenueCat has an active entitlement and the server is not synced, mobile calls the web sync endpoint to persist the purchase into `subscriptions`.

Mobile purchase analytics expose the full funnel without using PostHog as billing truth. The Profile offer and feature-gate modal emit `premium paywall viewed`; pressing an upgrade CTA emits `premium checkout started`; and only an active Premium entitlement in RevenueCat's returned `CustomerInfo` emits `premium purchase verified`. Verified events carry a sandbox/production environment marker. Missing entitlements, cancellations, unavailable checkouts, and failures remain separate outcomes, and the legacy ambiguous `premium purchased` event is no longer emitted.

The runner-facing subscription surfaces now keep App Store review compliance details close to the upgrade CTA:

- `ProfilePremiumSection.tsx` shows the subscription title, annual duration, current price string, and direct buttons for the privacy policy plus Apple standard Terms of Use (EULA);
- `PremiumUpsellModal.tsx` mirrors those same legal links and summary details for feature-gated upgrade prompts reached from plans, nutrition, and onboarding-adjacent flows;
- `useProfileScreen.ts` opens privacy on the web legal route and opens Apple’s standard EULA directly so iPhone and iPad review paths expose both required links without relying on App Store Connect metadata alone.

## Race Import

`apps/mobile/lib/race-import.ts` handles mobile GPX document picking and private race creation. It:

- accepts GPX/XML/plain/octet-stream file types from `expo-document-picker`;
- parses GPX with `parseGpxForRaceImport`;
- keeps the parsed route points in memory for mobile-only previews and future organizer-facing route rendering;
- builds localized import feedback;
- calls the web `/api/races` route with the bearer token;
- updates the created race to private/non-live via Supabase client.

`apps/mobile/components/race/GpxImportPreviewModal.tsx` now reuses `apps/mobile/components/race/GpxRoutePreviewCard.tsx` to show a compact mobile-native route sketch before confirming the import. That preview is intentionally dependency-light: it uses the parsed GPX points plus `react-native-svg`, not a browser map runtime, so it is safe inside the Expo app and ready to be reused later anywhere mobile receives organizer route geometry.

## RaceBook Sponsors

When a runner presses the RaceBook action in the Courses sheet, mobile starts the lightweight `/api/racebook-sponsors` request before navigation and warms the returned loading logos. `racebookSponsors.ts` shares that short-lived account/race-scoped in-flight request with the destination so the screen does not issue a duplicate lookup. Direct links use the same destination fallback without requiring prior catalog state. Published sponsor and RaceBook requests are anonymous-first to reuse the Vercel CDN; the session token is sent only on the private-preview retry. Server-mediated mobile fetches use the shared abortable timeout helper so a stalled public attempt cannot hold the loading flow indefinitely. The RaceBook starts its full data request on mount, holds its visible track at the initial position until the sponsor lookup and loading-logo prefetch settle, then advances toward a guarded pre-completion ceiling and visibly reaches 100% before content replaces it. Its dedicated loading composition keeps the native back/title header but temporarily hides feedback and the bottom tab bar. A localized preparation title, thin progress trail, and unframed runner form one compact group above a single sponsor panel; the panel reserves two vertically stacked slots separated by one subtle divider and occupies roughly one third of the available viewport. An empty or failed sponsor response removes the reserved panel and returns to the ordinary progress loader. When one or two loading sponsors exist, the 2.5-second minimum presentation starts only after that composition is ready, even when the RaceBook snapshot was already available from cache. Pull-to-refresh clears the short profile request cache and reloads RaceBook/profile/route data, but does not replay the sponsor interstitial.

Active banner sponsors render in a stable `Partenaires officiels` surface directly below the identity hero. The presentation respects principal, official, and service tiers, exposes a visible localized discovery action for linked sponsors, and reuses the same component for matching ravito, equipment, access, and services contexts. Loading, hero, and contextual impressions are emitted only after the logo loads and the surface becomes materially visible; they use a random per-view identifier through the aggregate endpoint and never join the runner analytics identity.

## RaceBook Edition Branding

The destination now waits for the real lightweight edition response before revealing RaceBook content. A slow response therefore cannot permanently leave one format on the default module map or colors while sibling formats use the published edition identity.

The same lightweight request carries the edition's published identity. Mobile normalizes that additive object through the shared design-system resolver. A valid published HTTPS logo is prefetched and rendered in the loading composition and identity hero while the shared release flag is enabled.

Primary colors style the image-backed identity hero, the softly tinted RaceBook background, active tabs, buttons, links, icons, badges, and structured relay/SAS/podium cards. Accent colors style progress, route, elevation profile, their lightly tinted cards, positive information rows, and decorative schedule highlights. Raw brand colors are preserved for solid identity surfaces, while derived text and graphic variants meet 4.5:1 and 3:1 contrast targets on white. The native header, bottom navigation, typography, runner illustration, and semantic red/orange/blue states remain Pace Yourself-owned. Missing, unpublished, or invalid values resolve to `#2D5016` and `#B45309`.

## RaceBook Module Visibility

The same lightweight server bootstrap returns an effective boolean map for edition and format modules. Mobile entirely removes inactive or locked Matériel, Dossard, Accès and Services tabs. Course remains permanent, while Ravitos, SAS, Relais and Podiums sub-tabs follow their format settings; official products are removed from ravito cards independently. Sponsors and branding are returned only when effective. When an older server response omits the map during rolling deployment, normalization defaults every module to the historical visible behavior.

## Plan Share Links

`apps/mobile/lib/planShareLinks.ts` calls `/api/plan-shares` through `WEB_API_BASE_URL`. The helper sends the current Supabase bearer token, the generated plan recap snapshot, locale, and departure time. Its screen-scoped synchronizer deduplicates identical background/share requests, refreshes the stable public snapshot when the recap opens or changes, and lets the explicit native-share action reuse the returned URL. The mobile app never generates database rows directly for public links and never handles service-role keys.

## Analytics

`apps/mobile/lib/posthog.ts` enables PostHog only when `EXPO_PUBLIC_POSTHOG_KEY` or `EXPO_PUBLIC_POSTHOG_TOKEN` is present. The host defaults to `https://us.i.posthog.com` unless `EXPO_PUBLIC_POSTHOG_HOST` is configured.

The analytics wrapper attaches `surface: app`, derives stable screen groups, and extracts only allowlisted UTM values plus scheme/host from deep links. The root layout records screen views, one app-session landing event, and initial or foreground deep-link openings with auth/Premium context; it never sends deep-link paths or arbitrary query values.

When an identified session belongs to `faustinbertrand1990@gmail.com` or has `admin` in trusted Supabase `app_metadata.role` / `app_metadata.roles`, the layout marks that PostHog person with `$internal_or_test_user`. Product dashboards can therefore exclude owner and admin activity with PostHog's internal/test-user filter.

After an accessible RaceBook finishes loading, the screen records its stable race/event identity, public names, race date, days-before-race window, tabs, ravito/access expansions, external actions, refreshes, and foreground-only active duration. This instrumentation is product analytics only: sponsor display and redirect counting remain outside person-level RaceBook events.

The guided catalog records `racebook onboarding search performed`, `racebook onboarding race selected`, and `racebook onboarding racebook selected`. Search events retain only query length and result counts, never the entered text. These explicit interactions replace a plain Catalog screen view as the meaningful pre-open funnel steps.

Confirmed favorite mutations emit `race favorite updated` with the public event id, bounded add/remove action, and resulting favorite count. Notification responses emit `push notification opened` with only a bounded kind/action and optional snooze duration; notification hrefs and message content are never analytics properties.

Do not copy actual keys into docs. Use environment variable names only.

## Gotchas

- Keep the fast Vitest suite Node-only and focused on pure modules. Code that imports Expo or React Native runtime modules belongs behind adapters or in the Maestro/device path; do not make unit tests depend on a native simulator.
- Keep `APP_VARIANT=development` aligned between the EAS development profile and local Expo startup. The Dev binary uses `com.paceyourself.app.dev`, while preview, E2E, and production retain `com.paceyourself.app`. The shared `paceyourself` scheme remains intentional because account-conversion redirects currently reference it explicitly; co-installed builds can therefore compete for deep links even though their application identifiers differ.
- A Firebase/Google services file is application-id-specific. The development variant reads only the dedicated `GOOGLE_SERVICES_JSON_DEV` / `EXPO_ANDROID_GOOGLE_SERVICES_FILE_DEV` and `GOOGLE_SERVICE_INFO_PLIST_DEV` / `EXPO_IOS_GOOGLE_SERVICES_FILE_DEV` variables. Without those optional files, Dev push/Google features remain unavailable; production files are deliberately not reused because they contain the wrong application identifier.
- Do not make optional structured RaceBook modules part of the whole-screen failure boundary. A PostgREST `404` before the corresponding migration/Data API exposure is deployed must degrade SAS, awards or structured services to an empty collection instead of hiding historical organizer content.
- Do not put mobile test credentials in Maestro YAML, screenshots, source files, or Expo public environment variables. Local runs may map the ignored `apps/web/.env.local` login keys into process-only `MAESTRO_*` variables; EAS runs must use secret variables in the `preview` environment.
- A clean Maestro launch exercises the real session bootstrap and can create an anonymous Supabase session before password login. Use a dedicated non-production test account and periodically clean disposable anonymous test users according to the project's normal data-retention process.

- The shared runtime is `1.1.1`. The light iOS appearance is native configuration, so a runtime-`1.1.1` iOS binary must reach testers/App Store before a `1.1.1` OTA is published; do not send that OTA to older iOS `1.1.0` binaries.
- Keep Google font imports weight-specific in the root layout. Replacing them with package-root imports adds unused font assets to every native export. Likewise, import Expo vector-icon families from their direct subpath (for example, `@expo/vector-icons/Ionicons`) instead of the package barrel so Metro does not retain unrelated icon-font families.
- The Google Play production submission profile is intentionally configured with `releaseStatus: completed`, so a successful EAS Submit releases the approved build to the full production track rather than creating a draft or staged rollout.
- Mobile writes some private race cleanup directly through Supabase after calling the web API. RLS must continue to allow owner updates for private races.
- The current mobile GPX route preview is a native SVG sketch, not an interactive slippy map. Reuse it when a lightweight course overview is enough; introduce a dedicated native map stack only when mobile really needs pan/zoom tiles.
- Mobile catalog and onboarding query `race_events` and `races.has_aid_stations`; visible migrations in this repo do not create all of those fields.
- Keep guided RaceBook filtering presentation-only: the initial list and any search result may contain only formats accepted by `canShowRacebook`; the flow must not invent a publication exception, persist the search text, or change the normal Courses catalog when the onboarding parameter is absent.
- Supabase embedded relations use left-join semantics by default. Keep the explicit `races!inner` plus `races.racebook_preview_is_visible = true` filter on the public catalog read so a visible event may render with private plan-capable formats and no public RaceBook. The organizer companion read remains bounded to ids from active memberships; after merging by stable event/race id, remove `racebook_preview_is_visible = false` formats before computing cards, counts, deep links, or format sheets.
- Hidden mobile detail headers should prefer one-line truncation over wrapping when the screen also shows custom left/right header actions; otherwise long French titles can overlap icons on compact iPhone widths.
- Keep the tab navigator on history-based back behavior. Switching it back to `initialRoute` makes Android hardware back jump to `catalog` from hidden plan/race detail screens instead of popping to the real previous screen.
- Keep the visible tab bar height and bottom padding derived from the bottom safe-area inset. A fixed height can place the tab actions underneath Android's three-button system navigation area.
- The mobile catalog has separate course and RaceBook contracts. A runner may see a preview-selected private format and create a plan from it, but `apps/mobile/lib/racebook.ts` still requires both course `is_live` and `racebook_is_live` before exposing its RaceBook action. An active event organizer resolved through `race_event_organizers` may preview that RaceBook before publication, but nobody receives a mobile entry for a format explicitly masked from preview. Meaningful non-ravito organizer content remains required; aid stations alone are not enough.
- Mobile visibility remains independent from web SEO visibility. `is_live`, `racebook_preview_is_visible`, and `race_event_editions.is_visible` continue to filter Courses/RaceBook in the app; a preserved `web_catalog_is_live` page must never be treated as mobile catalogue authorization.
- The mobile Racebook also parses additive geocoded organizer metadata for event/format, every structured bib-pickup location, and start/finish access. Published access locations expose an explicit Maps action; identical normalized start/finish addresses collapse into one row, and the optional general map is a secondary outlined action rather than a raw URL. A format date distinct from the event start date is emphasized in the identity card as a localized `Jour de course :` / `Race day:` calendar row. The `Dossard` tab groups pickup information by location, then by day inside one `Où et quand` card; each address stays plain and complete while a separate icon-only 44-point Maps action carries the full accessible label. Multiple time ranges on the same day are stacked below one localized short weekday/day/month label with locale-specific hour formatting (`Ven. 4 sept.` and `10h00 – 12h00` in French). Documents use their own compact card, rules use a lighter information block, and a legacy free-text schedule appears once only when no structured slots exist.
- Format-specific runner information is visible only when `access.overrideEnabled` and `access.enabledSections.runnerInfo` are both true; disabling either flag preserves the saved JSON while removing the identity-card block.
- The conditional mobile Racebook `Services` tab groups structured rows by category. Each compact row keeps name, approximate distance, address and a two-line description beside icon-only 44-point actions for directions, website and phone; legacy category text shares one light card instead of creating one card per paragraph.
- For relay or mixed formats, `Course` reads published `race_relay_points` and derives successive legs from start to finish. It displays handover time, cutoff, and notes in a conditional `Relais` course sub-tab without importing those points into nutrition or a saved plan.
- The mobile Racebook uses an image-backed identity hero with a primary-color overlay for event/format identity, course date, linked location, participation, distance, D+ and optional D-. The format image takes precedence over the event image, and a valid published edition logo sits on a neutral surface above the photograph. Participation is plain icon-led metadata rather than a second badge row. The title shares the return-action row, while official website, Instagram and Facebook actions stay at the right edge in both hero states. Scrolling progressively reduces the hero into the safe-area-aware sticky top header; focus resets the screen to its expanded top position. A valid emergency number occupies the expanded hero's lower free space with an explicit call action, then becomes one telephone icon before social actions when compact. Long compact titles truncate before this fixed action group. The available read-only sections use an inset-aware contextual bottom bar with a separated Courses exit. `Matériel` is an accessible checkbox list with an accent-colored completion summary; checks persist per account and exact race through owner-scoped Supabase rows, update optimistically, and roll back on failure. `Course` owns the start time and explicitly labeled finish cutoff, then separates longer content into `Tracé`, `Ravitos`, and conditional sub-tabs. The ravito list uses one continuous chronology: full-width unmarked departure and arrival cards sit at the content edge, while the rail leaves the first card, passes through indented numbered stations and segment distance/D+/D- summaries, then enters the finish card. A station already at race distance becomes that finish instead of another numbered ravito; otherwise the final segment is derived from race totals. Theme contrast-safe accent variants color checklist completion, non-semantic rail/structured-course cards, and decorative location/service actions across tabs, while warnings and information states keep app-owned semantic colors. Only stations with products or notes expand, one at a time. `Accès` retains its enabled-flag filtering, deduplicated locations, Maps actions, and collapsed parking/shuttle rows. Runner information stays in a neutral card only when present. Pull-to-refresh reloads RaceBook, profile, and route data while preserving successful content on refresh failure.
- Guided onboarding must reuse the real Courses, Nutrition, plan, and RaceBook routes. Keep its contextual behavior behind the `onboarding` route parameter so ordinary navigation remains unchanged.
- Keep onboarding skip durable in the per-tour status columns. `onboarding_completed_at` remains a legacy Plan-completion marker and must not be used to treat a skipped new tour as completed.
- Favorite writes are available only for identified, non-anonymous sessions. Anonymous users can still browse the catalog and see the heart; pressing it opens the shared account prompt with separate create-account and existing-account actions, without calling the favorite API.
- Favorite toggles preserve the runner's current reading position and visible order, with a short heart pulse disabled when reduced motion is requested. The server-confirmed set determines the next refresh's pinned ordering; failed writes restore the previous heart state and keep the existing error alert.
- Organizer update history in the event sheet is intentionally manual-announcement history only. Do not turn every organizer save into a runner-visible update.
- Keep French inactivity and unfinished-plan reminder punctuation aligned between the mobile locale and the Supabase Edge Function so authenticated and anonymous users receive the same copy.
- Keep the event-sheet default compact: preload only the short organizer-update preview with the catalog query, place its light-green announcement panel after every actionable format row, show only the newest (or deep-link-targeted) message at first, and reveal older messages plus the longer history only when the runner explicitly asks to see more.
- Read receipts are identified-user state. Anonymous sessions may read public updates but must not write `race_event_update_reads`.
- Trial duration must remain aligned with web and migrations: 15 days.
- Keep Premium monitoring shared across hook consumers. Reintroducing per-screen Auth, AppState, or RevenueCat listeners multiplies entitlement reads as tab screens mount.
- Do not treat RevenueCat as a separate entitlement table. It syncs into `subscriptions`.
- Do not use `premium paywall viewed` or `premium checkout started` as revenue. Only `premium purchase verified` confirms an active RevenueCat entitlement, and `environment: production` must still be reconciled with the store/RevenueCat transaction record.
- Keep both required legal links visible from reviewer-reachable purchase surfaces: privacy should open the web legal page, and Terms of Use should open Apple’s standard EULA unless the billing/legal strategy is intentionally changed.
- Do not put `RESEND_API_KEY` in Expo public env vars; mobile must go through `apps/mobile/lib/resendContactSync.ts` and the web route.
- Empty `EXPO_PUBLIC_WEB_URL` / `EXPO_PUBLIC_API_URL` values should fall back to the production web URL; mobile server calls must not build relative API URLs.
- Apple Sign in uses `expo-crypto` to hash the nonce challenge sent to Apple while Supabase receives the raw nonce for ID-token verification.
- Keep `@react-native-google-signin/google-signin` excluded from iOS in both `apps/mobile/package.json` and `apps/mobile/react-native.config.js`, and keep it out of `apps/mobile/app.config.ts` plugins unless native Google Sign-In is intentionally enabled on iOS; otherwise `GoogleSignIn` can both pull `AppCheckCore` back into the iOS pod graph and trigger a Fabric launch crash from a partially registered `RNGoogleSignInButton` component.
- Keep the mobile Racebook read-only. A course may remain in the catalog while its Racebook is hidden. The catalog CTA and direct screen load must enforce the public flags for runners and independently verify active event membership before granting an unpublished organizer preview. It must not import organizer dashboard mutation logic or admin routes. Preserve the identity, four primary tabs, conditional Services tab, the `Course` sub-tabs that separate route visuals, ravitos, and conditional relay legs, and the single-open ravito accordion so long station lists remain scannable without hiding their essential summary.
- Keep the route focused on loading, state and navigation: access cards live in `RacebookAccessSection`, the single-open ravito presentation in `RacebookAidStationsSection`, Material in `RacebookGearSection`, Dossard in `RacebookBibSection`, Services in `RacebookServicesSection`, and relay/SAS/podium cards in `RacebookStructuredCourseSections`. These components receive already-normalized data, explicit copy, callbacks and the resolved edition theme; they must not introduce their own data access or publication decisions. The route owns the per-race gear-check load/write state and passes item keys plus toggle callbacks into the presentational component.
- Keep sponsor requests server-mediated and edition-scoped. Reserve the unified two-slot loading panel before the lightweight sponsor response so late logos do not shift the page, but remove it once the lookup settles without placements. Restore the feedback action and inset-aware bottom tab bar as soon as loading completes or the screen unmounts. Keep the stable tiered partner surface and its contextual variants accessible and themed; do not restore the auto-rotating compact carousel. Never expose direct sponsor table access or the destination website URL and never replay the 2.5-second sponsor gate on refresh.
- Keep sponsor prefetch account-scoped and ephemeral. Catalog warmup may share the authorized server response with the immediately opened screen, but session changes must resolve a different cache key and direct navigation must remain fully functional.
- Do not remove or shorten the 2.5-second sponsor presentation when data becomes cache-fast. CDN and request deduplication optimize backend load; sponsor visibility remains a deliberate product requirement once at least one loading placement and its logo are ready.
- Keep edition branding on the published side of the same server-mediated lookup. Never read its table or draft fields from mobile, never bypass the shared logo kill switch, and never recolor functional warning, danger, or information states with organizer colors; accent surfaces are decorative or positive-information treatments only.
- Keep RaceBook engagement events scoped to public race/event metadata and screen interactions. Never attach sponsor identity or redirect data to the identified runner analytics stream, and use repeated opens for the same `race_id` when measuring RaceBook retention.
- Keep analytics admin detection on trusted `app_metadata`; never derive `$internal_or_test_user` from editable `user_metadata`.
- Keep the Racebook website, Instagram, Facebook, and emergency actions conditional on parsed event JSON. Accept only HTTP(S) link values and never construct a link from unvalidated free text. Keep icon-only social actions accessible with labels. Normalize French emergency numbers to the canonical `+33 X XX XX XX XX` display when organizer JSON is parsed, and strip display separators when opening the `tel:` URL.

- For an organizer-owned event, the normal mobile Courses view removes formats whose `racebook_preview_is_visible` is false before computing event counts or opening the format selector. A private non-live format keeps an enabled dimmed preview action. Other public catalog events keep their existing runner discovery behavior.

## Racebook Identity Presentation

The identity hero shows the event and format names, the formatted course date, linked location, icon-led participation metadata, distance, D+ and optional D-. It uses the format thumbnail before the event thumbnail, then a strong primary-color overlay so `onPrimaryColor` remains readable. Accessible icon-only social actions remain at the right edge in both expanded and compact states. `RacebookCollapsibleHero` owns its scroll-driven transition into the top safe area, uses the return row for its title, and keeps back navigation plus compact identity visible after the detailed metadata is clipped. When a valid emergency number exists, the expanded hero uses its lower free space for one aligned emergency label/contact/number line and a call action; the compact state keeps only a telephone icon immediately before social actions. Long compact titles truncate before that fixed action group. Runner information remains in a neutral detail card only when present.

## Related Docs

- [Overview](overview.md)
- [Add New Screen Mobile](../06-workflows/add-new-screen-mobile.md)
- [Premium Entitlement](../03-business-rules/premium-entitlement.md)
- [Trial Lifecycle](../03-business-rules/trial-lifecycle.md)
- [Analytics](../05-integrations/analytics.md)
