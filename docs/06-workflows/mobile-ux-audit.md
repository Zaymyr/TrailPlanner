---
title: Mobile UX Audit
scope: workflow
last_verified: 2026-09-24
ai_priority: high
related_files:
  - apps/mobile/package.json
  - apps/mobile/eas.json
  - apps/mobile/.eas/workflows/mobile-ux-audit.yml
  - apps/mobile/.maestro/config.yaml
  - apps/mobile/.maestro/flows/authenticated-shell.yaml
  - apps/mobile/scripts/run-mobile-ux-audit.mjs
  - apps/mobile/app/(auth)/login.tsx
  - apps/mobile/app/(app)/_layout.tsx
  - apps/mobile/components/inputs/NumericKeyboardAccessory.tsx
related_tables: []
---

# Mobile UX Audit

Plan-flow loading audits should flag determinate percentages unless the underlying operation reports real byte/task completion. The shared plan loader intentionally treats its internal progress values only as copy milestones, keeps the indicator indeterminate, and adds a neutral delayed reassurance for slow requests. Verify creation, editor, recap, onboarding handoff, and live preparation in both normal and reduced-motion modes.

## Purpose

Use one reproducible runner journey to catch broken navigation and produce comparable screenshots, then review those artifacts for hierarchy, density, consistency, clarity, and accessibility. An automated Maestro pass proves that the journey remains operable; it does not decide whether a screen is visually balanced.

## Key Concepts

- Functional smoke test: confirms that login and the four root tabs remain reachable.
- Unit test: validates pure mobile scheduling and RaceBook normalization in Node; it complements but does not replace the device journey.
- Visual audit: human review of named screenshots and screen recordings from the same journey.
- Stable selector: a locale-independent React Native `testID` such as `nav-tab-catalog`.
- Test account: a dedicated identified Supabase user whose Plan and RaceBook onboarding statuses do not both remain pending.
- Test matrix: Android and iOS at default size, followed periodically by compact-screen and enlarged-text manual sessions.

## Steps

1. Keep `MAESTRO_E2E_EMAIL` and `MAESTRO_E2E_PASSWORD` outside Git. For EAS, create them as secret variables in the `preview` environment. For a local run, export those variables; the ignored `EMAIL_DE_CONNEXION` and `MDP_Compte` keys in `apps/web/.env.local` are also mapped by the local runner.
2. Install the `e2e-test` build on the target emulator or device. Native modules make a real development/EAS build preferable to Expo Go.
   The interactive development client is a separate `Pace Yourself Dev` application with identifier `com.paceyourself.app.dev`; set `APP_VARIANT=development` when starting its local Expo server. The `e2e-test` profile keeps the base application identifier expected by the checked-in Maestro flow.
   The flow defaults to `com.paceyourself.app`, clears state, restarts the target and opens the login deep link. A physical-device audit of the development client must instead target its login route explicitly through ADB, then pass `APP_ID=com.paceyourself.app.dev`, `CLEAR_STATE=false`, and `SKIP_DEEP_LINK=true`; this preserves the active Metro connection and prevents state clearing or ambiguous shared-scheme routing from touching the installed production app. After a development-only integration error has been recorded, a capture-only rerun may additionally pass `SKIP_LOGIN=true` and `DISMISS_LOGBOX=true` to retain the authenticated session and close LogBox between screens without hiding the underlying defect in application code.
3. From the repository root, run `npm run test:e2e:ux -w @trailplanner/mobile`. The local runner fails without printing credentials when Maestro or the secrets are unavailable.
4. For the cloud matrix, first confirm that the Expo account includes hosted Maestro jobs. The current project plan does not. After a plan upgrade, change to `apps/mobile` and run `eas workflow:run .eas/workflows/mobile-ux-audit.yml`. Android and iOS then build and test in parallel; the jobs record video, retry one failure, and retain the nine named screenshots.
5. Compare the login, Courses, Plans, Nutrition, and Profile captures in the established bottom-tab order Courses → Plans → Nutrition → Profile. Review both the initial viewport and the post-scroll viewport; on iOS also confirm the dark status-bar content remains legible over the light palette.
6. Record every finding using the rubric below. Link the platform, screenshot, affected user goal, severity, and proposed correction.
7. After a correction, rerun the same flow and compare the same named artifact. Add a focused Maestro flow only when a new critical interaction cannot be represented safely in the shell journey.
8. On iOS, focus at least one numeric or decimal field and confirm the shared `Terminé` accessory dismisses the keyboard without closing the form or discarding its value.

9. On iOS, open a representative modal with VoiceOver: focus must remain inside the sheet, its title must be announced as a header, and each icon-only close action must announce its purpose with a 44-point target or equivalent hit slop.

## Visual Review Rubric

| Dimension | Review question | Typical evidence |
|---|---|---|
| Purpose | Can a first-time runner understand the screen's purpose and next action quickly? | Competing titles, unclear empty state, missing primary action |
| Hierarchy | Is there one visually dominant action for the current task? | Multiple filled buttons, weak section titles, important status below the fold |
| Density | Can content be scanned without reading every card? | Repeated explanations, oversized cards, long uninterrupted forms |
| Consistency | Do equivalent actions use the same component, spacing, radius, color, and wording? | Mixed button heights, inconsistent card padding, divergent icon treatment |
| Navigation | Is the current location clear and is returning predictable? | Hidden tabs, ambiguous back behavior, modal that resembles a page |
| Feedback | Does every tap, loading state, empty state, success, and error explain what happens next? | Silent save, indefinite spinner, technical error copy |
| Accessibility | Does the screen remain usable with screen reader, enlarged text, reduced motion, and safe-area constraints? | Missing labels, clipped text, small targets, color-only status |

Use these severities:

- Critical: the user cannot complete the task or may lose data.
- High: the main task is difficult, misleading, or inaccessible.
- Medium: inconsistency or density materially slows comprehension.
- Low: polish issue with limited task impact.

## Validation

Before accepting changes to the harness:

```bash
npm run test -w @trailplanner/mobile
npm run typecheck -w @trailplanner/mobile
npm run lint -w @trailplanner/mobile
npx expo-doctor apps/mobile
node --check apps/mobile/scripts/run-mobile-ux-audit.mjs
npx eas-cli@latest config --platform android --profile e2e-test
npx eas-cli@latest config --platform ios --profile e2e-test
```

When a binary and runner are available, the acceptance gate is a successful `authenticated-shell.yaml` run plus manual review of every screenshot and recording. Also run one compact-screen session and one enlarged-text session before a major release.

## Do Not

- Do not commit credentials or inject them through `EXPO_PUBLIC_*` variables.
- Do not treat screenshot generation as an automatic aesthetic verdict.
- Do not rely only on visible French or English text when a stable `testID` can identify the action.
- Do not auto-run the cross-platform EAS workflow on every commit without an explicit cost/latency decision.
- Do not mutate plans, favorites, purchases, or organizer data in the shell audit. Put destructive scenarios in isolated test-account flows with cleanup.
- Do not run a development-client audit without explicitly passing `APP_ID=com.paceyourself.app.dev`; both production and Dev may be installed on the same phone.
- Do not add an authentication or onboarding bypass to the production app for E2E convenience.

## Gotchas

- The mobile Vitest suite deliberately excludes Expo and React Native runtime behavior. A passing unit suite does not prove navigation, notifications, native billing, safe areas, or accessibility on a device; retain the Maestro and manual checks for those surfaces.
- A clean install uses the real application bootstrap and may create an anonymous Supabase session before password login. The dedicated test account and normal test-data retention process must account for that behavior.
- If the test account has both onboarding tours pending, the shell flow correctly fails because the root tab journey is not yet available. Prepare the account once instead of bypassing the gate.
- Local Windows execution requires Maestro to be available on `PATH` and an Android build to be installed. EAS is the versioned cross-platform target once the account supports hosted Maestro jobs.
- The checked-in EAS workflow is not executable on the project's current Expo plan because hosted Maestro jobs are paid. Keep it as the cross-platform target, or replace it deliberately with another CI runner before calling cloud coverage active.
- Screen recordings may slightly affect emulator timing; the workflow uses one retry, but repeated flakes should be fixed rather than hidden with more retries.
- `number-pad` and `decimal-pad` have no native return key on iOS. Every such field must stay connected to the shared numeric keyboard accessory; a form-level close button is not an equivalent keyboard-dismiss path.
- The login screen must remain scrollable with the keyboard visible and with enlarged Dynamic Type. A static centered form can hide the password, sign-in, or account-creation actions on compact iPhones.
- Changing Expo `userInterfaceStyle` is native configuration. Validate the new status-bar contrast in a matching iOS binary; an OTA cannot retrofit the appearance setting to an older runtime.
- Expo Doctor reports the deliberate Metro isolation and the separate React 18 web / React 19 mobile installs as monorepo warnings. Investigate new duplicate native-module warnings, but do not remove the mobile-first resolver without revalidating that Metro still resolves React 19 for React Native 0.81.
- Run mobile lint after a clean dependency install when changing its tooling. The legacy Expo ESLint config resolves `eslint-plugin-react-hooks` from the mobile workspace, so that plugin stays an explicit mobile development dependency rather than relying on local hoisting.
- For RaceBook navigation checks, open two different formats successively, then verify the hero arrow, contextual Courses action, and Android hardware back each replace the active route with Courses without revealing the first RaceBook.

## Related Docs

- [Mobile App](../01-architecture/mobile-app.md)
- [Add New Mobile Screen](add-new-screen-mobile.md)
- [Ship a Feature](ship-a-feature.md)
- [Auth Flows](../04-auth-and-security/auth-flows.md)
- [Design Tokens](../07-design-system/tokens.md)
