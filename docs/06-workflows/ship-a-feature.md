---
title: Ship a Feature
scope: workflow
last_verified: 2026-11-02
ai_priority: medium
related_files:
  - package.json
  - turbo.json
  - apps/web/package.json
  - apps/web/playwright.organizer.config.ts
  - apps/web/e2e/organizer-payment.spec.ts
  - apps/mobile/package.json
  - scripts/check-related-docs.mjs
  - .github/workflows/web-ci.yml
  - .github/workflows/main.yml
  - .github/workflows/eas-update-development.yml
  - .github/workflows/eas-update-production.yml
  - .github/CODEOWNERS
  - .github/pull_request_template.md
  - .github/dependabot.yml
related_tables: []
---

# Ship a Feature

> Terminologie : les textes français destinés aux utilisateurs emploient **Livret coureur** et les textes anglais **Race Book**. Les identifiants techniques stables — routes, événements analytics, objets de base de données et valeurs historiques — conservent `racebook`.

## Purpose

Use this workflow as a repo-level checklist for implementing and validating a feature.

## Key Concepts

- Surface: web, mobile, Supabase, or shared package.
- Blast radius: how many routes/tables/apps the change touches.
- Docs update: required when behavior, schema, auth, or workflows change.
- Worktree visibility: GitHub and remote CI cannot see uncommitted changes stored in another local worktree.

## Steps

1. Start every new task from a new branch based on the latest remote `main`:

```bash
git fetch origin
git switch -c dev/<task-name> origin/main
```

   Never reuse a branch from an already merged or closed pull request, and never place new work on a branch from a previous task. After the pull request is merged, delete its local and remote branches.
   Use the primary repository checkout and switch task branches there. Do not create another worktree unless the user explicitly requests isolated parallel work.
2. Read root `AGENTS.md`, then `docs/AGENTS.md`, and route yourself to the relevant domain docs. The root file is the canonical entry point for every assistant.
3. Search the existing implementation before adding new patterns:

```bash
rg -n "<feature keyword>" apps packages supabase
```

4. Make the smallest code/schema change that fits existing patterns.
5. Update docs for any changed business rule, table, auth flow, integration, or workflow.
6. Run targeted tests.
   Browser-component tests may opt into jsdom per file and use Testing Library, while pure data processing, camera math, and injectable controller tests should stay in Vitest's default Node environment. Mock browser providers such as Mapbox at their public boundary and assert lifecycle cleanup as well as visible behavior.
7. Run the repository verification gate before opening a pull request:

```bash
npm run verify
```

   `verify` first checks the `related_files` documentation protocol, then runs lint, TypeScript checks, the non-watch web and mobile unit suites, and the production build. Use `npm run verify:web` when iterating on a web-only change; the pull-request CI still runs the complete web gate as separate, visible steps.

8. For web UI changes, run/build the web app.
   Browser integrations with public provider tokens must also document the environment variable, origin restrictions, attribution, pricing boundary, and any downstream licensing gate.
   Paid server-side AI or voice providers (Anthropic, ElevenLabs) stay behind admin-only routes with server-only keys listed in `apps/web/.env.example`, and must answer with an explicit message when their key is missing.
   Server image changes must also exercise a real decode/resize test and a clean production build so Sharp's platform-specific binary is present in the deployed web workspace.
9. For mobile native changes, use the EAS/dev-client path.
10. For Supabase changes, verify RLS and service-role behavior separately.
11. For mobile dependency changes, keep both the root workspace lockfile and `apps/mobile/package-lock.json` aligned when both are present.
    Run `npx expo-doctor apps/mobile` after installation and distinguish intentional monorepo Metro isolation warnings from actual SDK version mismatches.
    Native config plugins such as `@react-native-community/datetimepicker` require a new development/store binary; do not describe their JavaScript usage as OTA-only delivery, and keep an older-runtime fallback when development OTAs may arrive first.
    Run `npm run lint -w @trailplanner/mobile` after TypeScript or JavaScript changes.
    Android release variants use R8 minification and resource shrinking through `expo-build-properties`. Smoke-test the optimized internal-track candidate before production promotion and retain the `mapping.txt` produced by that exact AAB; a debug build or another version's mapping is not equivalent evidence.
    Keep Expo ESLint plugins used by the legacy config explicit in `apps/mobile/devDependencies`; do not rely on a plugin being transitively hoisted in an existing local `node_modules` tree.
12. For mobile navigation, authentication, or visual changes, run the Maestro shell journey and review its screenshots against [Mobile UX Audit](mobile-ux-audit.md). Treat the automated pass as functional evidence, not as proof that the composition is harmonious.
13. Immediately before pushing `main` or promoting production, run the local worktree release audit:

```bash
git worktree list --porcelain
git log --branches --not --remotes --oneline
```

   For every `worktree` path in the first command, run `git -C <path> status --short --branch`. Stop the release when any worktree is dirty or when any commit is local-only. Resolve each item by committing and pushing it, integrating it into the release branch, or obtaining an explicit user decision to abandon it. A clean current directory alone is not sufficient evidence.

The web CI workflow runs on pull requests and on `main`; it also accepts an explicit dispatch so an automated schema-snapshot branch can receive the required status even though GitHub suppresses pull-request workflow events created by `GITHUB_TOKEN`. It fetches Git history and runs `npm run docs:check` against the pull-request base commit or the previous `main` commit, then runs lint, typecheck, the complete web Vitest suite, and the production build. The mobile pre-check runs on pull requests and on `main` when mobile code, shared packages, workspace manifests, the lockfile, Turbo configuration, or its workflow changes. It blocks on mobile lint, typecheck, unit tests, and Expo dependency compatibility. Keep targeted local tests for fast feedback, but do not remove these full gates from CI.

Vercel Cron invokes the daily RevenueCat subscription reconciliation declared in `vercel.json`. Changes to that schedule or route require the matching `CRON_SECRET` and RevenueCat server configuration to exist in the target deployment; merging code alone does not create provider webhook integrations or deployment secrets.

`main` requires a pull request, the strict `web` and `static-migration-checks` statuses, and an up-to-date branch. Production GitHub jobs use the protected `Production` environment and require the configured reviewer. Supabase migrations are not coupled to a merge: dispatch the migration workflow with the exact merged SHA, the confirmation phrase, and a separate environment approval. The post-migration schema snapshot opens its own pull request instead of bypassing branch protection.

Development OTA publication runs on every mobile-relevant push to `dev/**` and `main`, but only after the same mobile lint, typecheck, unit tests, and Expo dependency checks pass. This ensures both feature-branch iterations and their merged or direct `main` commits reach the EAS `development` channel and environment consumed by the installed `Pace Yourself Dev` build. The job still references the GitHub `Preview` environment solely because that existing environment stores `EXPO_TOKEN`; this GitHub secret boundary does not select the EAS OTA target. Production OTA publication is never automatic on a push to `main`: dispatch it manually with the exact commit SHA already merged into `main`, confirm with `PROMOTE_TO_PRODUCTION`, and use the protected `production` GitHub environment for required reviewer approval. Promote only changes already validated through the development OTA flow. The dispatch always publishes the current runtime first and accepts one optional `legacy_ios_runtime_version`; when supplied, it validates the semantic version and publishes the same bundle to that iOS runtime only. Use this compatibility bridge solely for JavaScript already verified against the older native binary, never for a change that depends on a newer native module or configuration.

For native delivery, a merged `main` commit starts the EAS candidate workflow but waits for explicit approval before either platform build begins. After approval, it builds Android and iOS, leaves Android on the internal track as a draft, and uploads iOS to TestFlight. Android public rollout uses the separately protected GitHub dispatch, which verifies the selected build metadata against the exact approved commit; Apple public review/release remains an App Store Connect decision. Never point an automatic trigger at the full-rollout Android `production` submit profile.

Files under GitHub workflows, Supabase, auth, and payment boundaries have targeted CODEOWNERS review. Dependabot consolidates routine npm and GitHub Actions minor/patch maintenance into one monthly multi-ecosystem pull request, with an open-version-update limit of one per ecosystem as a fallback. Security updates can still open separate urgent pull requests and must not be delayed merely to preserve the monthly batch. Dependency pull requests must pass the same verification gates as feature changes, but `dependabot/**` branches do not create Vercel deployments; the approved merge on `main` is the single production build. npm and GitHub Actions major upgrades are excluded from automatic PRs and must be planned as explicit migrations. Expo SDK and native React Native dependencies are excluded from isolated Dependabot bumps and must be upgraded together through `npx expo install`. The Supabase client is capped below the release that drops Node 20 support until the repository deliberately migrates its CI and runtimes to Node 22.

The organizer payment journey is an explicit, destructive test-mode check: run `npm run test:e2e:organizer-payment -w @trailplanner/web` only with `RUN_ORGANIZER_PAYMENT_E2E=1`, `ORGANIZER_E2E_EMAIL`, `ORGANIZER_E2E_PASSWORD`, and an optional `ORGANIZER_E2E_BASE_URL`. It refuses non-`cs_test_` Stripe Checkout sessions and deletes its uniquely named `TEST` event both through the UI and a fallback API cleanup.

Generated organizer invoices have a non-destructive focused gate: run the organizer-payment route tests plus `lib/organizer-invoice-document.test.ts`. The latter loads the emitted bytes back through `pdf-lib` to confirm a valid one-page PDF and stable document metadata; SQL numbering/immutability is covered separately by `supabase/tests/organizer_generated_invoice_checks.sql`.

The mobile UX gate is intentionally manual to control EAS usage. The immediately available path is `npm run test:e2e:ux -w @trailplanner/mobile` with a local Android device. The cross-platform target can be launched from `apps/mobile` with `eas workflow:run .eas/workflows/mobile-ux-audit.yml` only after the Expo account supports hosted Maestro jobs; its `preview` environment must contain secret `MAESTRO_E2E_EMAIL` and `MAESTRO_E2E_PASSWORD` variables.

The root `packageManager` pin is required by Turbo workspace discovery. Update it deliberately alongside npm upgrades instead of removing it.

## Do Not

- Do not start a new task from an existing feature branch or reuse a branch whose pull request was merged or closed.
- Do not create an additional worktree for ordinary sequential work.
- Do not push `main` or promote production while another registered worktree is dirty or a local commit is absent from all remotes.
- Do not invent schema fields; verify migrations or live schema.
- Do not edit `_archive` as current docs.
- Do not add generic SaaS prose to project docs.
- Do not skip duplicate-event/idempotency checks for onboarding/auth flows.
- Do not bypass a failing CI check by making it non-blocking.
- Do not publish a production OTA from an unmerged ref or without validating the changes through the development OTA flow first.

## Native-module reminder

When a mobile change adds an Expo native module, bump the runtime compatibility group, require a new native build, and keep OTA publication on the matching runtime. Lot 8 follows this rule for `expo-haptics` with runtime `1.1.2`.

## Related Docs

- [AGENTS](../AGENTS.md)
- [Overview](../01-architecture/overview.md)
- [Schema Overview](../02-database/schema-overview.md)
- [RLS Checklist](../04-auth-and-security/rls-checklist.md)
