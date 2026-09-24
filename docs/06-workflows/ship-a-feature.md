---
title: Ship a Feature
scope: workflow
last_verified: 2026-09-23
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
  - .github/workflows/eas-update-preview.yml
  - .github/workflows/eas-update-production.yml
  - .github/CODEOWNERS
  - .github/pull_request_template.md
  - .github/dependabot.yml
related_tables: []
---

# Ship a Feature

## Purpose

Use this workflow as a repo-level checklist for implementing and validating a feature.

## Key Concepts

- Surface: web, mobile, Supabase, or shared package.
- Blast radius: how many routes/tables/apps the change touches.
- Docs update: required when behavior, schema, auth, or workflows change.

## Steps

1. Start every new task from a new branch based on the latest remote `main`:

```bash
git fetch origin
git switch -c dev/<task-name> origin/main
```

   Never reuse a branch from an already merged or closed pull request, and never place new work on a branch from a previous task. After the pull request is merged, delete its local and remote branches.
2. Read `docs/AGENTS.md` and route yourself to the relevant domain docs.
3. Search the existing implementation before adding new patterns:

```bash
rg -n "<feature keyword>" apps packages supabase
```

4. Make the smallest code/schema change that fits existing patterns.
5. Update docs for any changed business rule, table, auth flow, integration, or workflow.
6. Run targeted tests.
7. Run the repository verification gate before opening a pull request:

```bash
npm run verify
```

   `verify` first checks the `related_files` documentation protocol, then runs lint, TypeScript checks, the non-watch web and mobile unit suites, and the production build. Use `npm run verify:web` when iterating on a web-only change; the pull-request CI still runs the complete web gate as separate, visible steps.

8. For web UI changes, run/build the web app.
   Server image changes must also exercise a real decode/resize test and a clean production build so Sharp's platform-specific binary is present in the deployed web workspace.
9. For mobile native changes, use the EAS/dev-client path.
10. For Supabase changes, verify RLS and service-role behavior separately.
11. For mobile dependency changes, keep both the root workspace lockfile and `apps/mobile/package-lock.json` aligned when both are present.
    Run `npx expo-doctor apps/mobile` after installation and distinguish intentional monorepo Metro isolation warnings from actual SDK version mismatches.
    Run `npm run lint -w @trailplanner/mobile` after TypeScript or JavaScript changes.
    Keep Expo ESLint plugins used by the legacy config explicit in `apps/mobile/devDependencies`; do not rely on a plugin being transitively hoisted in an existing local `node_modules` tree.
12. For mobile navigation, authentication, or visual changes, run the Maestro shell journey and review its screenshots against [Mobile UX Audit](mobile-ux-audit.md). Treat the automated pass as functional evidence, not as proof that the composition is harmonious.

The web CI workflow runs on pull requests and on `main`. It fetches Git history and runs `npm run docs:check` against the pull-request base commit or the previous `main` commit, then runs lint, typecheck, the complete web Vitest suite, and the production build. The mobile pre-check runs on pull requests and on `main` when mobile code, shared packages, workspace manifests, the lockfile, Turbo configuration, or its workflow changes. It blocks on mobile lint, typecheck, unit tests, and Expo dependency compatibility. Keep targeted local tests for fast feedback, but do not remove these full gates from CI.

Preview OTA publication runs only after the same mobile lint, typecheck, unit tests, and Expo dependency checks pass. Production OTA publication is never automatic on a push to `main`: dispatch it manually with the exact commit SHA already merged into `main`, confirm with `PROMOTE_TO_PRODUCTION`, and use the protected `production` GitHub environment for required reviewer approval. Promote only a commit already validated on preview.

Files under GitHub workflows, Supabase, auth, and payment boundaries have targeted CODEOWNERS review. Dependabot consolidates routine npm and GitHub Actions minor/patch maintenance into one monthly multi-ecosystem pull request, with an open-version-update limit of one per ecosystem as a fallback. Security updates can still open separate urgent pull requests and must not be delayed merely to preserve the monthly batch. Dependency pull requests must pass the same verification gates as feature changes, but `dependabot/**` branches do not create Vercel deployments; the approved merge on `main` is the single production build. npm and GitHub Actions major upgrades are excluded from automatic PRs and must be planned as explicit migrations. Expo SDK and native React Native dependencies are excluded from isolated Dependabot bumps and must be upgraded together through `npx expo install`. The Supabase client is capped below the release that drops Node 20 support until the repository deliberately migrates its CI and runtimes to Node 22.

The organizer payment journey is an explicit, destructive test-mode check: run `npm run test:e2e:organizer-payment -w @trailplanner/web` only with `RUN_ORGANIZER_PAYMENT_E2E=1`, `ORGANIZER_E2E_EMAIL`, `ORGANIZER_E2E_PASSWORD`, and an optional `ORGANIZER_E2E_BASE_URL`. It refuses non-`cs_test_` Stripe Checkout sessions and deletes its uniquely named `TEST` event both through the UI and a fallback API cleanup.

Generated organizer invoices have a non-destructive focused gate: run the organizer-payment route tests plus `lib/organizer-invoice-document.test.ts`. The latter loads the emitted bytes back through `pdf-lib` to confirm a valid one-page PDF and stable document metadata; SQL numbering/immutability is covered separately by `supabase/tests/organizer_generated_invoice_checks.sql`.

The mobile UX gate is intentionally manual to control EAS usage. The immediately available path is `npm run test:e2e:ux -w @trailplanner/mobile` with a local Android device. The cross-platform target can be launched from `apps/mobile` with `eas workflow:run .eas/workflows/mobile-ux-audit.yml` only after the Expo account supports hosted Maestro jobs; its `preview` environment must contain secret `MAESTRO_E2E_EMAIL` and `MAESTRO_E2E_PASSWORD` variables.

The root `packageManager` pin is required by Turbo workspace discovery. Update it deliberately alongside npm upgrades instead of removing it.

## Do Not

- Do not start a new task from an existing feature branch or reuse a branch whose pull request was merged or closed.
- Do not invent schema fields; verify migrations or live schema.
- Do not edit `_archive` as current docs.
- Do not add generic SaaS prose to project docs.
- Do not skip duplicate-event/idempotency checks for onboarding/auth flows.
- Do not bypass a failing CI check by making it non-blocking.
- Do not publish a production OTA from an unmerged ref or without validating it on preview first.

## Related Docs

- [AGENTS](../AGENTS.md)
- [Overview](../01-architecture/overview.md)
- [Schema Overview](../02-database/schema-overview.md)
- [RLS Checklist](../04-auth-and-security/rls-checklist.md)
