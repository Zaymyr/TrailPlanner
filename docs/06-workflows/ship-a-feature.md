---
title: Ship a Feature
scope: workflow
last_verified: 2026-06-10
ai_priority: medium
related_files:
  - package.json
  - turbo.json
  - apps/web/package.json
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
