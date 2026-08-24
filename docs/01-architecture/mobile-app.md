---
title: Mobile App Architecture
scope: architecture
last_verified: 2026-08-24
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
Required onboarding is registered as a non-tab screen in the app layout and hides the bottom tab bar until completion or an explicit confirmed skip. Setup steps expose a compact header skip action, while the final notification screen keeps its existing skip-step control; both normal completion and skipping persist `user_profiles.onboarding_completed_at` before the flow exits, while the gate retains legacy profile/favorite fallbacks.
Catalog and onboarding race event rows share `apps/mobile/components/race/RaceEventSummaryCard.tsx` so the onboarding race choice uses the same event-card UX as the Courses tab.
The tab shell in `apps/mobile/app/(app)/_layout.tsx` also registers hidden detail routes such as `race/[id]/racebook` explicitly so Expo Router does not surface them as bottom-tab destinations while keeping normal pushed navigation behavior. The tabs use history-based back behavior so Android hardware back returns to the actual previous screen instead of always snapping to the default `plans` tab when a hidden detail route was pushed.
The visible bottom tab bar derives its bottom padding and total height from `react-native-safe-area-context`. This keeps the four tab actions above Android's three-button navigation area while preserving the existing minimum spacing on gesture-navigation devices and iOS.
Organizer update pushes deep-link into the catalog with `eventId`, `updateId`, and an optional `raceId`. The catalog reopens the event sheet, loads an older targeted message when it is outside the preview, places that message first, and highlights the concerned format.
Shared hidden-screen headers use `apps/mobile/components/navigation/AppHeaderTitle.tsx` with explicit title-container insets from `apps/mobile/app/(app)/_layout.tsx`. When a screen adds extra header actions, keep enough right inset for those icons so long French titles truncate cleanly instead of overlapping the header buttons on narrow iPhones.

## Catalog and Event Sheets

`apps/mobile/app/(app)/catalog.tsx` is now the runner surface for event favorites and organizer announcements:

- it loads favorited `race_events` for identified, non-anonymous users through the web API bridge;
- it pins favorite events above the normal date/name ordering while keeping the existing catalog grouping, then confirms a successful addition with a brief localized toast and scrolls the list to the newly pinned first event;
- it reuses `RaceEventSummaryCard.tsx` for the event row and exposes the same favorite toggle inside the event sheet;
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

## Plan Share Links

`apps/mobile/lib/planShareLinks.ts` calls `/api/plan-shares` through `WEB_API_BASE_URL`. The helper sends the current Supabase bearer token, the generated plan recap snapshot, locale, and departure time. The mobile app never generates database rows directly for public links and never handles service-role keys.

## Analytics

`apps/mobile/lib/posthog.ts` enables PostHog only when `EXPO_PUBLIC_POSTHOG_KEY` or `EXPO_PUBLIC_POSTHOG_TOKEN` is present. The host defaults to `https://us.i.posthog.com` unless `EXPO_PUBLIC_POSTHOG_HOST` is configured.

Do not copy actual keys into docs. Use environment variable names only.

## Gotchas

- Keep the shared/iOS runtime at `1.1.0` until a new iOS native build is released. Android overrides it with `1.1.1`; Android production OTAs must be published from configuration that resolves that platform runtime.
- The Google Play production submission profile is intentionally configured with `releaseStatus: completed`, so a successful EAS Submit releases the approved build to the full production track rather than creating a draft or staged rollout.
- Mobile writes some private race cleanup directly through Supabase after calling the web API. RLS must continue to allow owner updates for private races.
- The current mobile GPX route preview is a native SVG sketch, not an interactive slippy map. Reuse it when a lightweight course overview is enough; introduce a dedicated native map stack only when mobile really needs pan/zoom tiles.
- Mobile catalog and onboarding query `race_events` and `races.has_aid_stations`; visible migrations in this repo do not create all of those fields.
- Hidden mobile detail headers should prefer one-line truncation over wrapping when the screen also shows custom left/right header actions; otherwise long French titles can overlap icons on compact iPhone widths.
- Keep the tab navigator on history-based back behavior. Switching it back to `initialRoute` makes Android hardware back jump to `plans` from hidden plan/race detail screens instead of popping to the real previous screen.
- Keep the visible tab bar height and bottom padding derived from the bottom safe-area inset. A fixed height can place the tab actions underneath Android's three-button system navigation area.
- The mobile catalog has an explicit runner-facing organizer contract for `race_events.organizer_details` / `races.organizer_details`: use `apps/mobile/lib/racebook.ts` to keep gating, parsing, and read-only composition aligned. The entry point requires both course `is_live` and `racebook_is_live`, plus meaningful non-ravito organizer content; aid stations alone are not enough.
- The mobile Racebook also parses additive geocoded organizer metadata for event/format, every structured bib-pickup location, and start/finish access. When a published organizer location includes a Google Maps URL, the location value itself is rendered as an inline tappable link instead of forcing runners to copy/paste the address manually. The `Dossard` tab groups pickup information by location, then by day; multiple time ranges on the same day are stacked below one localized short weekday/day/month label, with locale-specific hour formatting (`Ven. 4 sept.` and `10h00 – 12h00` in French). Legacy single-location/free-text schedules remain readable.
- The mobile Racebook uses a compact identity card for event/format identity, event date range, optional distinct format date, location, and runner information; distance, D+, D-, and start-time metric pills are intentionally omitted from this synthesis. Its four permanent read-only tabs are `Matériel`, `Dossard`, `Course`, and `Accès`, plus a fifth `Services` tab only when event service details exist. `Course` owns the start time in a light-green important-information row, finish-cutoff constraints in a critical row, the interactive GPX map, elevation profile, and aid stations; `Accès` owns linked start/finish locations plus parking, shuttles, road restrictions, map links, and access notes. A populated parking value remains runner-visible even when the format-level parking flag is false. When published, the official website and emergency contact appear as equal-height action tiles in a right-hand panel beside the race identity; the native header keeps feedback only. The emergency tile opens the platform phone app through `tel:`. Pulling down anywhere on the screen reloads the Racebook, profile, and route data while preserving the last successful content if that refresh fails.
- Keep shared race-event display changes in `RaceEventSummaryCard.tsx` so catalog and onboarding do not drift visually.
- Keep onboarding skip durable: write `user_profiles.onboarding_completed_at` before routing away, and retain the legacy durable-data fallback for profiles onboarded before the marker existed.
- Favorite toggles are available only for identified, non-anonymous sessions. Anonymous users should still browse the catalog without write affordances or favorite API calls.
- The success toast and automatic list repositioning apply only when adding a favorite after the API confirms the write. Removing a favorite keeps the runner's current reading position, and failed writes restore the previous order before showing the existing error alert.
- Organizer update history in the event sheet is intentionally manual-announcement history only. Do not turn every organizer save into a runner-visible update.
- Keep the event-sheet default compact: preload only the short organizer-update preview with the catalog query, place its light-green announcement panel after every actionable format row, show only the newest (or deep-link-targeted) message at first, and reveal older messages plus the longer history only when the runner explicitly asks to see more.
- Read receipts are identified-user state. Anonymous sessions may read public updates but must not write `race_event_update_reads`.
- Trial duration must remain aligned with web and migrations: 15 days.
- Do not treat RevenueCat as a separate entitlement table. It syncs into `subscriptions`.
- Keep both required legal links visible from reviewer-reachable purchase surfaces: privacy should open the web legal page, and Terms of Use should open Apple’s standard EULA unless the billing/legal strategy is intentionally changed.
- Do not put `RESEND_API_KEY` in Expo public env vars; mobile must go through `apps/mobile/lib/resendContactSync.ts` and the web route.
- Empty `EXPO_PUBLIC_WEB_URL` / `EXPO_PUBLIC_API_URL` values should fall back to the production web URL; mobile server calls must not build relative API URLs.
- Apple Sign in uses `expo-crypto` to hash the nonce challenge sent to Apple while Supabase receives the raw nonce for ID-token verification.
- Keep `@react-native-google-signin/google-signin` excluded from iOS in both `apps/mobile/package.json` and `apps/mobile/react-native.config.js`, and keep it out of `apps/mobile/app.config.ts` plugins unless native Google Sign-In is intentionally enabled on iOS; otherwise `GoogleSignIn` can both pull `AppCheckCore` back into the iOS pod graph and trigger a Fabric launch crash from a partially registered `RNGoogleSignInButton` component.
- Keep the mobile Racebook read-only. A course may remain in the catalog while its Racebook is hidden; both the catalog CTA and direct screen load must enforce `racebook_is_live = true` in addition to the existing live/content checks. It must not import organizer dashboard mutation logic or admin routes. The existing identity, four-tab, map, equipment, bib, course, access, and ravito presentation contract remains unchanged.
- Keep the Racebook website and emergency actions conditional on parsed event JSON. Never construct a site link from unvalidated free text. Normalize French emergency numbers to the canonical `+33 X XX XX XX XX` display when organizer JSON is parsed, and strip display separators when opening the `tel:` URL.

## Related Docs

- [Overview](overview.md)
- [Add New Screen Mobile](../06-workflows/add-new-screen-mobile.md)
- [Premium Entitlement](../03-business-rules/premium-entitlement.md)
- [Trial Lifecycle](../03-business-rules/trial-lifecycle.md)
- [Analytics](../05-integrations/analytics.md)
