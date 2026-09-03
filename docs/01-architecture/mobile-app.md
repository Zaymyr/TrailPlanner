---
title: Mobile App Architecture
scope: architecture
last_verified: 2026-09-03
ai_priority: high
related_files:
  - apps/mobile/package.json
  - apps/mobile/react-native.config.js
  - apps/mobile/app.config.ts
  - apps/mobile/eas.json
  - apps/mobile/app/_layout.tsx
  - apps/mobile/app/(app)/_layout.tsx
  - apps/mobile/components/navigation/AppHeaderTitle.tsx
  - apps/mobile/app/(app)/catalog.tsx
  - apps/mobile/app/(app)/profile.tsx
  - apps/mobile/app/(app)/onboarding.tsx
  - apps/mobile/lib/onboardingGate.ts
  - apps/mobile/lib/onboardingStatus.ts
  - apps/mobile/lib/onboardingStatusCore.ts
  - apps/mobile/components/onboarding/OnboardingGuideCard.tsx
  - apps/mobile/components/profile/ProfileOnboardingSection.tsx
  - apps/mobile/app/(app)/race/_layout.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/components/premium/PremiumUpsellModal.tsx
  - apps/mobile/components/profile/ProfileLanguageSection.tsx
  - apps/mobile/components/profile/ProfilePremiumSection.tsx
  - apps/mobile/components/race/GpxImportPreviewModal.tsx
  - apps/mobile/components/race/GpxRoutePreviewCard.tsx
  - apps/mobile/components/race/RacebookLeafletMap.tsx
  - apps/mobile/components/race/RaceEventSummaryCard.tsx
  - apps/mobile/lib/gpx.ts
  - apps/mobile/hooks/usePremium.ts
  - apps/mobile/hooks/useProfileScreen.ts
  - apps/mobile/lib/race-import.ts
  - apps/mobile/lib/racebook.ts
  - apps/mobile/lib/racebookOnboarding.ts
  - apps/mobile/lib/racebookSponsors.ts
  - apps/mobile/lib/racebookSponsorPresentation.ts
  - apps/mobile/locales/types.ts
  - apps/mobile/locales/fr.ts
  - apps/mobile/locales/en.ts
  - apps/mobile/lib/resendContactSync.ts
  - apps/mobile/lib/planShareLinks.ts
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
- Resend contact sync: mobile calls the web API bridge after identified, non-anonymous sessions; the Resend key remains server-side.
- Plan share links: mobile sends an authenticated recap snapshot to the web API, which creates the public crew URL server-side.
- Event favorites: authenticated runners can favorite `race_events`, pin them to the top of the Courses tab, and receive organizer update pushes for those events.

## Framework Setup

`apps/mobile/package.json` declares:

- `expo ~54.0.33`
- `expo-router ~6.0.23`
- `react 19.1.0`
- `react-native 0.81.5`
- `@supabase/supabase-js ^2.45.4`
- `expo-dev-client ~6.0.20`
- `expo-crypto ~15.0.8`
- `expo-updates ~29.0.16`
- `@react-native-google-signin/google-signin ^16.1.2` for Android native Google Sign-In only
- `react-native-purchases ^9.15.1`
- `posthog-react-native ^4.45.0`
- `react-native-webview 13.15.0` for the interactive Racebook Leaflet map

The app config in `apps/mobile/app.config.ts` declares:

- app name `Pace Yourself`;
- slug `pace-yourself-app`;
- owner `pace-yourself`;
- scheme `paceyourself`;
- app version `1.1.1`;
- shared/iOS runtime version `1.1.0`;
- Android runtime version `1.1.1` for the Android 16 / API 36 native build;
- EAS project id `c713a8a0-cd94-4f6e-9468-063c9c20da6c`;
- update URL `https://u.expo.dev/c713a8a0-cd94-4f6e-9468-063c9c20da6c`.

Expo SDK 54 and React Native 0.81 compile against and target Android 16 / API 36. The project relies on those SDK defaults rather than adding a redundant `expo-build-properties` override.

`apps/mobile/package.json` excludes `@react-native-google-signin/google-signin` from Expo iOS autolinking, `apps/mobile/react-native.config.js` disables the package for iOS in the React Native community autolinking layer, and `apps/mobile/app.config.ts` does not register the package's Expo config plugin. Native Google Sign-In is Android-only in `apps/mobile/hooks/useGoogleAuth.ts`, while iOS uses the browser OAuth path; keeping the package out of the iOS native build avoids both the Swift `AppCheckCore` CocoaPods conflict on EAS and Fabric startup crashes from partially registered Google Sign-In native components.

## EAS Profiles

`apps/mobile/eas.json` defines:

- `development`: internal distribution and `developmentClient: true`.
- `preview`: internal distribution, Android APK, iOS Release.
- `production`: Android app bundle, iOS Release, auto-increment enabled.
- `submit.production.android`: completed release on the Google Play `production` track.
- `submit.production.ios.ascAppId`: App Store Connect app id `6772180071` for TestFlight submissions.

Because the dependency set includes native modules such as `expo-dev-client`, `react-native-purchases`, notifications, secure store, Apple auth, and `expo-crypto`, use the development client profile for realistic local/device testing. Expo Go can only be assumed for flows that do not require these native modules.

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

The layout also tracks auth analytics for signed-in and signed-out events.
Cold-start and post-auth navigation resolves the mobile onboarding statuses first, then opens either the initial chooser, a persisted in-progress stage, or the Courses catalog.
The initial chooser is skippable and offers independent Plan and RaceBook tours. Plan setup remains a hidden non-tab flow, then hands off to the real Courses, Nutrition, plan creation, and editor screens. RaceBook uses the real Courses catalog and published RaceBook screen. In the guided RaceBook mode, the catalog requires a deliberate search of at least two characters before showing results, removes formats that fail the ordinary runner RaceBook gate, and exposes only the RaceBook action so selecting a course cannot divert into plan creation. Those real screens keep normal tab navigation and add a non-blocking guide card. `user_profiles.plan_onboarding_status` and `racebook_onboarding_status` distinguish pending, in-progress, skipped, and completed states; local AsyncStorage retains the current stage/race for cold-start resumption.
The Profile personal tab exposes both tours with their statuses. Its tab icon shows a notification dot until both are completed; skipped tours intentionally keep the dot visible. Replaying a completed tour does not downgrade its durable status.
On cold start and after authentication, sessions that do not require onboarding open on the `catalog` Courses tab by default. The tab shell in `apps/mobile/app/(app)/_layout.tsx` also registers hidden detail routes such as `race/[id]/racebook` explicitly so Expo Router does not surface them as bottom-tab destinations while keeping normal pushed navigation behavior. The tabs use history-based back behavior so Android hardware back returns to the actual previous screen instead of snapping to the default `catalog` tab when a hidden detail route was pushed.
The visible bottom tab bar derives its bottom padding and total height from `react-native-safe-area-context`. This keeps the four tab actions above Android's three-button navigation area while preserving the existing minimum spacing on gesture-navigation devices and iOS.
Organizer update pushes deep-link into the catalog with `eventId`, `updateId`, and an optional `raceId`. The catalog reopens the event sheet, loads an older targeted message when it is outside the preview, places that message first, and highlights the concerned format.
French inactivity and unfinished-plan notifications come from `apps/mobile/locales/fr.ts`; their titles use typographic apostrophes and must stay aligned with the server-side reminder copy.
Shared hidden-screen headers use `apps/mobile/components/navigation/AppHeaderTitle.tsx` with explicit title-container insets from `apps/mobile/app/(app)/_layout.tsx`. When a screen adds extra header actions, keep enough right inset for those icons so long French titles truncate cleanly instead of overlapping the header buttons on narrow iPhones.

## Catalog and Event Sheets

`apps/mobile/app/(app)/catalog.tsx` is now the runner surface for event favorites and organizer announcements:

- its event relation uses an inner join filtered to `races.is_live = true`, so a hidden edition contributes no format and an event with no visible format is excluded; onboarding applies the same nested live-format filter;
- it loads favorited `race_events` for identified, non-anonymous users through the web API bridge;
- it pins favorite events above the normal date/name ordering while keeping the existing catalog grouping, then confirms a successful addition with a brief localized toast and scrolls the list to the newly pinned first event;
- it reuses `RaceEventSummaryCard.tsx` for the event row and exposes the same favorite toggle inside the event sheet;
- its multi-format event cards omit the repeated “choose a format” helper sentence because the format-count pill and primary action already communicate the next step; onboarding may keep that guidance in the same shared component;
- its guided RaceBook mode starts with an empty result state until the runner enters at least two search characters, then returns only events containing an ordinarily accessible published RaceBook and removes the competing plan action from the format sheet;
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

When RevenueCat has an active entitlement and the server is not synced, mobile calls the web sync endpoint to persist the purchase into `subscriptions`.

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

When a runner presses the RaceBook action in the Courses sheet, mobile starts the lightweight `/api/racebook-sponsors` request before navigation and warms the returned loading logos. `racebookSponsors.ts` shares that short-lived account/race-scoped in-flight request with the destination so the screen does not issue a duplicate lookup. Direct links use the same destination fallback without requiring prior catalog state. The RaceBook starts its full data request on mount, holds its visible track at the initial position until the sponsor lookup and loading-logo prefetch settle, then advances toward a guarded pre-completion ceiling and visibly reaches 100% before content replaces it. Its dedicated loading composition keeps the native back/title header but temporarily hides feedback and the bottom tab bar. A localized preparation title, thin progress trail, and unframed runner form one compact group above a single sponsor panel; the panel reserves two vertically stacked slots separated by one subtle divider and occupies roughly one third of the available viewport. An empty or failed sponsor response removes the reserved panel and returns to the ordinary progress loader. When one or two loading sponsors exist, the 2.5-second minimum presentation starts only after that composition is ready. Pull-to-refresh reloads only RaceBook data so the sponsor interstitial is not replayed.

Active banner sponsors render in a roughly 44 dp strip before the identity card, with 24 dp logos and native text. One sponsor is centered without animation. With two or more sponsors, the banner is a width-independent horizontal carousel: one centered sponsor remains visible for three seconds, transitions to the next over 520 ms, and uses a duplicate first slide to loop without a visible backward jump. System reduced-motion preference disables autoplay and switches to a manually scrollable horizontal list. Only rows with a redirect URL are pressable, and all sponsor links open the counted server redirect rather than a direct target.

## Plan Share Links

`apps/mobile/lib/planShareLinks.ts` calls `/api/plan-shares` through `WEB_API_BASE_URL`. The helper sends the current Supabase bearer token, the generated plan recap snapshot, locale, and departure time. The mobile app never generates database rows directly for public links and never handles service-role keys.

## Analytics

`apps/mobile/lib/posthog.ts` enables PostHog only when `EXPO_PUBLIC_POSTHOG_KEY` or `EXPO_PUBLIC_POSTHOG_TOKEN` is present. The host defaults to `https://us.i.posthog.com` unless `EXPO_PUBLIC_POSTHOG_HOST` is configured.

The analytics wrapper attaches `surface: app`, derives stable screen groups, and extracts only allowlisted UTM values plus scheme/host from deep links. The root layout records screen views, one app-session landing event, and initial or foreground deep-link openings with auth/Premium context; it never sends deep-link paths or arbitrary query values.

After an accessible RaceBook finishes loading, the screen records its stable race/event identity, public names, race date, days-before-race window, tabs, ravito/access expansions, external actions, refreshes, and foreground-only active duration. This instrumentation is product analytics only: sponsor display and redirect counting remain outside person-level RaceBook events.

The guided catalog records `racebook onboarding search performed`, `racebook onboarding race selected`, and `racebook onboarding racebook selected`. Search events retain only query length and result counts, never the entered text. These explicit interactions replace a plain Catalog screen view as the meaningful pre-open funnel steps.

Do not copy actual keys into docs. Use environment variable names only.

## Gotchas

- Keep the shared/iOS runtime at `1.1.0` until a new iOS native build is released. Android overrides it with `1.1.1`; Android production OTAs must be published from configuration that resolves that platform runtime.
- The Google Play production submission profile is intentionally configured with `releaseStatus: completed`, so a successful EAS Submit releases the approved build to the full production track rather than creating a draft or staged rollout.
- Mobile writes some private race cleanup directly through Supabase after calling the web API. RLS must continue to allow owner updates for private races.
- The current mobile GPX route preview is a native SVG sketch, not an interactive slippy map. Reuse it when a lightweight course overview is enough; introduce a dedicated native map stack only when mobile really needs pan/zoom tiles.
- Mobile catalog and onboarding query `race_events` and `races.has_aid_stations`; visible migrations in this repo do not create all of those fields.
- Keep the guided RaceBook search gate presentation-only: it may narrow already-loaded live formats with `canShowRacebook`, but it must not invent a publication exception, persist the search text, or change the normal Courses catalog when the onboarding parameter is absent.
- Supabase embedded relations use left-join semantics by default. Keep the explicit `races!inner` plus `races.is_live = true` filters in catalog/onboarding so edition hiding cannot leak formats or leave empty event cards.
- Hidden mobile detail headers should prefer one-line truncation over wrapping when the screen also shows custom left/right header actions; otherwise long French titles can overlap icons on compact iPhone widths.
- Keep the tab navigator on history-based back behavior. Switching it back to `initialRoute` makes Android hardware back jump to `catalog` from hidden plan/race detail screens instead of popping to the real previous screen.
- Keep the visible tab bar height and bottom padding derived from the bottom safe-area inset. A fixed height can place the tab actions underneath Android's three-button system navigation area.
- The mobile catalog has an explicit runner-facing organizer contract for `race_events.organizer_details` / `races.organizer_details`: use `apps/mobile/lib/racebook.ts` to keep gating, parsing, and read-only composition aligned. Ordinary runners require both course `is_live` and `racebook_is_live`; an active event organizer resolved through `race_event_organizers` may preview before publication. Both paths still require meaningful non-ravito organizer content; aid stations alone are not enough.
- The mobile Racebook also parses additive geocoded organizer metadata for event/format, every structured bib-pickup location, and start/finish access. Published access locations expose an explicit Maps action; identical normalized start/finish addresses collapse into one row, and the optional general map is a labeled button rather than a raw URL. A format date distinct from the event start date is emphasized in the identity card as a localized `Jour de course :` / `Race day:` calendar row. The `Dossard` tab groups pickup information by location, then by day; each address is shown directly without a redundant `Pickup location`/`Lieu de retrait` heading, and multiple time ranges on the same day are stacked below one localized short weekday/day/month label with locale-specific hour formatting (`Ven. 4 sept.` and `10h00 – 12h00` in French). Legacy single-location/free-text schedules remain readable.
- The conditional mobile Racebook `Services` tab renders each populated category in its own titled card and displays organizer content as plain text without list bullets.
- For relay or mixed formats, `Course` reads published `race_relay_points` and derives successive legs from start to finish. It displays handover time, cutoff, and notes in a conditional `Relais` course sub-tab without importing those points into nutrition or a saved plan.
- The mobile Racebook uses a compact identity card for event/format identity, event date range, optional distinct format date, location, and runner information; distance, D+, D-, and start-time metric pills are intentionally omitted from this synthesis. Its flexible metadata row uses calendar/location icons, dot separators, and compact `Solo` and/or `Relais` badges, with mixed formats rendered as two separate badges. Its four permanent read-only tabs are `Matériel`, `Dossard`, `Course`, and `Accès`, plus a fifth `Services` tab only when event service details exist. `Course` owns the start time in a light-green important-information row and finish-cutoff constraints in a critical row, then separates its longer content into `Tracé` (interactive GPX map plus elevation profile), `Ravitos`, and a conditional `Relais` sub-tab. The ravito list is a single-open accordion: every collapsed row retains the station name, distance, available-service icons, segment D+/D-, and optional cutoff, while expansion reveals the labeled service controls, full metric column, organizer products, and notes. `Accès` orders access notes and road restrictions in an amber `À retenir` block, then locations/maps, then a `Venir sur place` card whose parking and shuttle rows start collapsed with two-line summaries; expanding the shuttle row separates its schedule in a clock treatment. Parking, shuttles, road restrictions, and map content are runner-visible only while their corresponding format-level access flag is enabled, even if a saved value still exists. When published, the official website, Instagram, and Facebook links appear as a compact icon-only outlined group beside the race identity, with Instagram and Facebook below the website icon; accessibility labels retain their meaning without visible text. A divider separates the emergency contact, which keeps `Urgence - nom - téléphone` on one line alongside a localized outlined call action; the full row opens the platform phone app through `tel:`. The native header keeps feedback only. Pulling down anywhere on the screen reloads the Racebook, profile, and route data while preserving the last successful content if that refresh fails.
- Guided onboarding must reuse the real Courses, Nutrition, plan, and RaceBook routes. Keep its contextual behavior behind the `onboarding` route parameter so ordinary navigation remains unchanged.
- Keep onboarding skip durable in the per-tour status columns. `onboarding_completed_at` remains a legacy Plan-completion marker and must not be used to treat a skipped new tour as completed.
- Favorite toggles are available only for identified, non-anonymous sessions. Anonymous users should still browse the catalog without write affordances or favorite API calls.
- The success toast and automatic list repositioning apply only when adding a favorite after the API confirms the write. Removing a favorite keeps the runner's current reading position, and failed writes restore the previous order before showing the existing error alert.
- Organizer update history in the event sheet is intentionally manual-announcement history only. Do not turn every organizer save into a runner-visible update.
- Keep French inactivity and unfinished-plan reminder punctuation aligned between the mobile locale and the Supabase Edge Function so authenticated and anonymous users receive the same copy.
- Keep the event-sheet default compact: preload only the short organizer-update preview with the catalog query, place its light-green announcement panel after every actionable format row, show only the newest (or deep-link-targeted) message at first, and reveal older messages plus the longer history only when the runner explicitly asks to see more.
- Read receipts are identified-user state. Anonymous sessions may read public updates but must not write `race_event_update_reads`.
- Trial duration must remain aligned with web and migrations: 15 days.
- Do not treat RevenueCat as a separate entitlement table. It syncs into `subscriptions`.
- Keep both required legal links visible from reviewer-reachable purchase surfaces: privacy should open the web legal page, and Terms of Use should open Apple’s standard EULA unless the billing/legal strategy is intentionally changed.
- Do not put `RESEND_API_KEY` in Expo public env vars; mobile must go through `apps/mobile/lib/resendContactSync.ts` and the web route.
- Empty `EXPO_PUBLIC_WEB_URL` / `EXPO_PUBLIC_API_URL` values should fall back to the production web URL; mobile server calls must not build relative API URLs.
- Apple Sign in uses `expo-crypto` to hash the nonce challenge sent to Apple while Supabase receives the raw nonce for ID-token verification.
- Keep `@react-native-google-signin/google-signin` excluded from iOS in both `apps/mobile/package.json` and `apps/mobile/react-native.config.js`, and keep it out of `apps/mobile/app.config.ts` plugins unless native Google Sign-In is intentionally enabled on iOS; otherwise `GoogleSignIn` can both pull `AppCheckCore` back into the iOS pod graph and trigger a Fabric launch crash from a partially registered `RNGoogleSignInButton` component.
- Keep the mobile Racebook read-only. A course may remain in the catalog while its Racebook is hidden. The catalog CTA and direct screen load must enforce the public flags for runners and independently verify active event membership before granting an unpublished organizer preview. It must not import organizer dashboard mutation logic or admin routes. Preserve the identity, four primary tabs, conditional Services tab, the `Course` sub-tabs that separate route visuals, ravitos, and conditional relay legs, and the single-open ravito accordion so long station lists remain scannable without hiding their essential summary.
- Keep sponsor requests server-mediated and edition-scoped. Reserve the unified two-slot loading panel before the lightweight sponsor response so late logos do not shift the page, but remove it once the lookup settles without placements. Restore the feedback action and inset-aware bottom tab bar as soon as loading completes or the screen unmounts. Keep the compact banner carousel based on viewport-sized slides rather than aggregate content measurement, and keep reduced-motion users on the manual list. Never expose direct sponsor table access or the destination website URL and never replay the 2.5-second sponsor gate on refresh.
- Keep sponsor prefetch account-scoped and ephemeral. Catalog warmup may share the authorized server response with the immediately opened screen, but session changes must resolve a different cache key and direct navigation must remain fully functional.
- Keep RaceBook engagement events scoped to public race/event metadata and screen interactions. Never attach sponsor identity or redirect data to the identified runner analytics stream, and use repeated opens for the same `race_id` when measuring RaceBook retention.
- Keep the Racebook website, Instagram, Facebook, and emergency actions conditional on parsed event JSON. Accept only HTTP(S) link values and never construct a link from unvalidated free text. Keep icon-only social actions accessible with labels. Normalize French emergency numbers to the canonical `+33 X XX XX XX XX` display when organizer JSON is parsed, and strip display separators when opening the `tel:` URL.

## Racebook Identity Presentation

The identity card shows the formatted course date directly beneath the race name, using the compact calendar metadata style; the event date range is not displayed there. Its metadata uses smaller text, calendar/location icons, dot separators, and compact participation badges so more content fits on one row. The emergency row exposes only `Urgence` and the optional contact name beside the localized outlined call action; it keeps the normalized phone only for the `tel:` target and does not display it.

## Related Docs

- [Overview](overview.md)
- [Add New Screen Mobile](../06-workflows/add-new-screen-mobile.md)
- [Premium Entitlement](../03-business-rules/premium-entitlement.md)
- [Trial Lifecycle](../03-business-rules/trial-lifecycle.md)
- [Analytics](../05-integrations/analytics.md)
