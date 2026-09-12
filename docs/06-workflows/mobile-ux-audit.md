---
title: Mobile UX Audit
scope: workflow
last_verified: 2026-09-12
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
related_tables: []
---

# Mobile UX Audit

## Purpose

Use one reproducible runner journey to catch broken navigation and produce comparable screenshots, then review those artifacts for hierarchy, density, consistency, clarity, and accessibility. An automated Maestro pass proves that the journey remains operable; it does not decide whether a screen is visually balanced.

## Key Concepts

- Functional smoke test: confirms that login and the four root tabs remain reachable.
- Visual audit: human review of named screenshots and screen recordings from the same journey.
- Stable selector: a locale-independent React Native `testID` such as `nav-tab-catalog`.
- Test account: a dedicated identified Supabase user whose Plan and RaceBook onboarding statuses do not both remain pending.
- Test matrix: Android and iOS at default size, followed periodically by compact-screen and enlarged-text manual sessions.

## Steps

1. Keep `MAESTRO_E2E_EMAIL` and `MAESTRO_E2E_PASSWORD` outside Git. For EAS, create them as secret variables in the `preview` environment. For a local run, export those variables; the ignored `EMAIL_DE_CONNEXION` and `MDP_Compte` keys in `apps/web/.env.local` are also mapped by the local runner.
2. Install the `e2e-test` build on the target emulator or device. Native modules make a real development/EAS build preferable to Expo Go.
3. From the repository root, run `npm run test:e2e:ux -w @trailplanner/mobile`. The local runner fails without printing credentials when Maestro or the secrets are unavailable.
4. For the cloud matrix, first confirm that the Expo account includes hosted Maestro jobs. The current project plan does not. After a plan upgrade, change to `apps/mobile` and run `eas workflow:run .eas/workflows/mobile-ux-audit.yml`. Android and iOS then build and test in parallel; the jobs record video, retry one failure, and retain the nine named screenshots.
5. Compare the login, Courses, Plans, Nutrition, and Profile captures. Review both the initial viewport and the post-scroll viewport.
6. Record every finding using the rubric below. Link the platform, screenshot, affected user goal, severity, and proposed correction.
7. After a correction, rerun the same flow and compare the same named artifact. Add a focused Maestro flow only when a new critical interaction cannot be represented safely in the shell journey.

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
npm run typecheck -w @trailplanner/mobile
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
- Do not add an authentication or onboarding bypass to the production app for E2E convenience.

## Gotchas

- A clean install uses the real application bootstrap and may create an anonymous Supabase session before password login. The dedicated test account and normal test-data retention process must account for that behavior.
- If the test account has both onboarding tours pending, the shell flow correctly fails because the root tab journey is not yet available. Prepare the account once instead of bypassing the gate.
- Local Windows execution requires Maestro to be available on `PATH` and an Android build to be installed. EAS is the versioned cross-platform target once the account supports hosted Maestro jobs.
- The checked-in EAS workflow is not executable on the project's current Expo plan because hosted Maestro jobs are paid. Keep it as the cross-platform target, or replace it deliberately with another CI runner before calling cloud coverage active.
- Screen recordings may slightly affect emulator timing; the workflow uses one retry, but repeated flakes should be fixed rather than hidden with more retries.
- After a shared RaceBook presentation change, keep the existing real-device RaceBook check: the organizer browser phone is not evidence that Expo navigation, external actions, or analytics still behave correctly.

## Related Docs

- [Mobile App](../01-architecture/mobile-app.md)
- [Add New Mobile Screen](add-new-screen-mobile.md)
- [Ship a Feature](ship-a-feature.md)
- [Auth Flows](../04-auth-and-security/auth-flows.md)
- [Design Tokens](../07-design-system/tokens.md)
