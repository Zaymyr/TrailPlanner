---
title: Ship a Feature
scope: workflow
last_verified: 2026-09-10
ai_priority: medium
related_files:
  - package.json
  - turbo.json
  - apps/web/package.json
  - apps/web/playwright.organizer.config.ts
  - apps/web/e2e/organizer-payment.spec.ts
  - apps/mobile/package.json
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

1. Read `docs/AGENTS.md` and route yourself to the relevant domain docs.
2. Search the existing implementation before adding new patterns:

```bash
rg -n "<feature keyword>" apps packages supabase
```

3. Make the smallest code/schema change that fits existing patterns.
4. Update docs for any changed business rule, table, auth flow, integration, or workflow.
5. Run targeted tests.
6. Run broader checks when shared code, schema, or auth behavior changed:

```bash
npm run typecheck
npm run test
npm run lint
```

7. For web UI changes, run/build the web app.
8. For mobile native changes, use the EAS/dev-client path.
9. For Supabase changes, verify RLS and service-role behavior separately.
10. For mobile dependency changes, keep both the root workspace lockfile and `apps/mobile/package-lock.json` aligned when both are present.
11. For mobile navigation, authentication, or visual changes, run the Maestro shell journey and review its screenshots against [Mobile UX Audit](mobile-ux-audit.md). Treat the automated pass as functional evidence, not as proof that the composition is harmonious.

The web CI workflow runs lint, typecheck, the complete web Vitest suite, then the production build. Keep targeted local tests for fast feedback, but do not remove the full test gate from CI.

The organizer payment journey is an explicit, destructive test-mode check: run `npm run test:e2e:organizer-payment -w @trailplanner/web` only with `RUN_ORGANIZER_PAYMENT_E2E=1`, `ORGANIZER_E2E_EMAIL`, `ORGANIZER_E2E_PASSWORD`, and an optional `ORGANIZER_E2E_BASE_URL`. It refuses non-`cs_test_` Stripe Checkout sessions and deletes its uniquely named `TEST` event both through the UI and a fallback API cleanup.

The mobile UX gate is intentionally manual to control EAS usage. The immediately available path is `npm run test:e2e:ux -w @trailplanner/mobile` with a local Android device. The cross-platform target can be launched from `apps/mobile` with `eas workflow:run .eas/workflows/mobile-ux-audit.yml` only after the Expo account supports hosted Maestro jobs; its `preview` environment must contain secret `MAESTRO_E2E_EMAIL` and `MAESTRO_E2E_PASSWORD` variables.

The root `packageManager` pin is required by Turbo workspace discovery. Update it deliberately alongside npm upgrades instead of removing it.

## Do Not

- Do not invent schema fields; verify migrations or live schema.
- Do not edit `_archive` as current docs.
- Do not add generic SaaS prose to project docs.
- Do not skip duplicate-event/idempotency checks for onboarding/auth flows.

## Related Docs

- [AGENTS](../AGENTS.md)
- [Overview](../01-architecture/overview.md)
- [Schema Overview](../02-database/schema-overview.md)
- [RLS Checklist](../04-auth-and-security/rls-checklist.md)
