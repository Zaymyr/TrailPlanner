---
title: Release Flow (one PR per task, merge = production)
scope: workflow
last_verified: 2026-11-21
ai_priority: high
related_files:
  - .github/workflows/pull-request.yml
  - .github/workflows/release.yml
  - .github/workflows/db-migrate.yml
  - .github/workflows/eas-update-production.yml
  - .github/workflows/db-schema-snapshot.yml
  - scripts/release/release-check.mjs
  - scripts/release/release-check.test.mjs
  - vercel.json
related_tables: []
---

# Release Flow

## Purpose

One task is one `dev/*` branch and one pull request into `main`. Every commit of the task goes to that PR. The PR is where the task is tested; **merging it is the production go**: migrations, web production and the production OTA follow automatically, with no further dispatch, confirmation phrase or environment approval. Only store binaries stay manual, because Apple and Google review them anyway.

The PR answers « where am I? »: open = being tested, merged = in production. One status comment on the PR (`<!-- release-status:pr -->`) and one release comment per merge (`<!-- release-status:release -->`) summarize everything; Vercel, Expo and Supabase only need to be opened when something fails.

## While the PR is open

`.github/workflows/pull-request.yml` runs on every push, on `opened`/`reopened`/`ready_for_review`, and re-evaluates on label changes:

| Job | What it does |
| --- | --- |
| `release-guards` | Runs the script tests, then `scripts/release/release-check.mjs` on the PR range (base SHA → merge commit). Blocks the merge on a destructive migration or a native change without a new runtime (see Guards). |
| `dev-ota` | When the mobile app changed: lint, typecheck, unit tests, Expo dependency check, then `eas update --channel development` (installed in **Pace Yourself Dev**). Uses the GitHub `Preview` environment only because it stores `EXPO_TOKEN`. |
| `status-comment` | Creates or updates the single status comment: web Preview, dev OTA link, migrations, native verdict, and what the merge will deploy. |

The web Preview is the ordinary Vercel Git deployment of the PR branch; its URL is in Vercel's own PR comment. The existing `web` (Web CI), `static-migration-checks` (DB Verify) and mobile pre-check workflows still run on the PR.

The `development` channel is shared: it always holds the **last PR pushed**. Testing two PRs at once on the device means re-pushing (or re-running `dev-ota` on) the one you want to see.

## Merging = production

`.github/workflows/release.yml` runs on every push to `main` (and by manual dispatch on `main`), one run at a time (`release-production` concurrency, never cancelled):

1. `plan` resolves the **released range**: from the head SHA of the last successful `Release` run that is an ancestor of `HEAD`, to `HEAD`. A failed, cancelled or skipped release is therefore included in the next one. Without any previous successful run it releases `HEAD^..HEAD`. It analyses the range, finds the merged PR and its labels, and evaluates the guards.
2. `migrate` (only when the range contains `supabase/migrations/*.sql`) calls `db-migrate.yml` with the exact SHA: drift check, validation of every pending migration, dry run, session inspection, `supabase db push --include-all`. A remote-only version still blocks the job.
3. `web` (only when web inputs changed, and only if `migrate` succeeded or was skipped) deploys with `vercel@65.9.0 deploy --prod --archive=tgz` from the repository root; the project root directory `apps/web` and `vercel.json` apply as for Git deployments. It needs the `VERCEL_TOKEN` secret of the `Production` environment.
4. `ota` (only when the mobile app changed and the guards allow it, and only if `migrate` succeeded or was skipped) calls `eas-update-production.yml`: lint, typecheck, tests, Expo check, `eas update --branch production`.
5. `report` posts the release comment on the merged PR (and the job summary): each step's result, the deployment URL, and, when native code changed, the exact store-candidate commands for that SHA.

`db-schema-snapshot.yml` listens to both `Supabase DB Migrate` and `Release`, so the schema snapshot PR still follows a production migration.

Web inputs are `apps/web/`, `packages/`, root `package.json` / `package-lock.json`, `turbo.json` and `vercel.json`. Mobile inputs are `apps/mobile/` (excluding `apps/mobile/.eas/` and Markdown), `packages/`, root `package.json` / `package-lock.json`.

`vercel.json` sets `git.deploymentEnabled.main` to `false`: Vercel no longer deploys `main` by itself, so production web can never run ahead of the migrations. It declares no crons (every scheduled web task is a pg_cron job, shipped by the migrations of the same release). Preview deployments of other branches are unchanged.

## Guards

`scripts/release/release-check.mjs` (pure functions covered by `release-check.test.mjs`, run with `node --test scripts/release/release-check.test.mjs`; passing the directory does not work on Node 24):

- **Destructive migration**: statements that can lose data or break the previous web/app version — `drop table`, `drop schema`, `drop column`, `truncate`, `delete from`, `rename`, column type changes — in added or changed migrations. Comments and dollar-quoted function/`DO` bodies are ignored. Blocks the PR unless it carries the label `migration-destructive-ok`. Before adding it, make sure the version currently in production (site and installed apps) keeps working once the migration has run: prefer expand → migrate → contract over two PRs.
- **Native change**: a runtime dependency added or changed in `apps/mobile/package.json` whose package ships native code (`ios`, `android`, `*.podspec`, `expo-module.config.json`, `app.plugin.js`), a change of the resolved Expo config other than `version`, `description`, `extra`, `runtimeVersion`, `android.versionCode`, `ios.buildNumber`, `android.playStoreUrl`, `ios.appStoreUrl`, or a change under `apps/mobile/plugins` / `apps/mobile/patches`. The base config is rebuilt from the base commit next to the real project so it resolves the same `node_modules`.
  - Runtime bumped in the same PR: allowed. The production OTA goes to the new runtime, which no installed binary has yet, and the release comment asks for a store build.
  - Runtime unchanged: blocks the PR unless it carries the label `native-ota-safe`, meaning the JavaScript does not depend on the new native code (for example only associated domains or a manifest flag changed). The OTA is then published to the current runtime and a store build is still needed to activate the native part.
  - In `release.yml` the same evaluation decides whether the production OTA runs at all, as a second line of defence.

## Store builds

Still manual, after the merge that needs one. From `apps/mobile`, with the exact merged SHA (never `--ref main`, which has resolved to a stale commit):

```bash
eas workflow:run .eas/workflows/store-candidate-ios.yml --ref <full main SHA>
eas workflow:run .eas/workflows/store-candidate-android.yml --ref <full main SHA>
```

Check `Using workflow file … at <sha>` before approving the EAS gate. Bump `version` in `apps/mobile/app.config.ts` whenever App Store Connect has closed the current version train.

## When something fails

- PR guard blocked: fix the migration or the runtime, or add the label after checking; the guard re-runs on the label change.
- Release step failed: open the run linked in the release comment and use « Re-run failed jobs ». Steps after a failed migration do not run, so production stays consistent (the old site keeps working on an additive schema).
- Web rollback: promote the previous deployment in Vercel (instant rollback).
- OTA rollback: `eas update:republish` the previous production group, or publish a fix through a new PR.
- Manual entry points remain available for exceptional cases: `db-migrate.yml` and `eas-update-production.yml` dispatches (with their confirmation phrases, including the legacy iOS runtime bridge).

## Setup (one-time, outside the repository)

- `VERCEL_TOKEN` secret in the GitHub `Production` environment (a Vercel token with access to the `zaymyrs-projects` team).
- No required reviewer on the GitHub `Production` environment; otherwise every release waits for an approval.
- `release-guards` added to the required status checks of the `Protect Main` ruleset.
- Labels `migration-destructive-ok` and `native-ota-safe`.

## Gotchas

- A PR whose required `release-guards` check is red cannot be merged; this is what makes merge = production safe. Do not make the guard non-blocking.
- `cancel-in-progress` is per PR and per event type: a label change never cancels a code run that is publishing the dev OTA.
- The release compares with the last **successful** release, not with the previous commit: after a red release, the next merge redeploys everything since the last green one.
- The CLI web deployment uploads tracked files of the CI checkout only; local `.env*` files never reach Vercel.
- Workflows triggered by `GITHUB_TOKEN` (bot PRs) do not start `pull-request.yml`; the schema snapshot PR dispatches its required checks itself.
