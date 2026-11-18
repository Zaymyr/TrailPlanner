import test from "node:test";
import assert from "node:assert/strict";

import {
  COMMENT_MARKER_PR,
  COMMENT_MARKER_RELEASE,
  LABEL_DESTRUCTIVE_OK,
  LABEL_NATIVE_OTA_SAFE,
  classifyPaths,
  diffDependencies,
  diffNativeConfig,
  evaluateGuards,
  findDestructiveStatements,
  renderPrReport,
  renderReleaseReport,
} from "./release-check.mjs";

const baseAnalysis = (overrides = {}) => ({
  base: "a".repeat(40),
  head: "b".repeat(40),
  areas: { web: false, mobile: false },
  migrations: [],
  destructive: [],
  native: null,
  ...overrides,
});

const native = (overrides = {}) => ({
  nativeDependencies: [],
  configChanges: [],
  pluginChanges: [],
  runtimeBase: "1.1.2",
  runtimeHead: "1.1.2",
  runtimeBumped: false,
  nativeChange: false,
  ...overrides,
});

test("classifyPaths separates web, mobile and migration changes", () => {
  assert.deepEqual(classifyPaths(["docs/README.md", ".github/workflows/release.yml"]), {
    web: false,
    mobile: false,
    migrations: [],
  });
  assert.equal(classifyPaths(["apps/web/app/page.tsx"]).web, true);
  assert.equal(classifyPaths(["vercel.json"]).web, true);
  const shared = classifyPaths(["packages/shared/src/index.ts"]);
  assert.equal(shared.web && shared.mobile, true);
  assert.equal(classifyPaths(["apps/mobile/app/(app)/index.tsx"]).mobile, true);
  assert.equal(classifyPaths(["apps/mobile/.eas/workflows/store-candidate-ios.yml"]).mobile, false);
  assert.deepEqual(classifyPaths(["supabase/migrations/20261118000000_x.sql", "supabase/tests/x.sql"]).migrations, [
    "supabase/migrations/20261118000000_x.sql",
  ]);
});

test("findDestructiveStatements flags data-losing statements only", () => {
  const sql = `
    -- drop table public.commented_out;
    create table public.things (id uuid primary key);
    alter table public.things add column name text;
    alter table public.old drop column legacy;
    drop table if exists public.gone;
    alter table public.items rename column a to b;
    alter table public.items alter column price type numeric;
    truncate public.cache;
    create or replace function public.cleanup() returns void language plpgsql as $$
    begin
      delete from public.cache where created_at < now();
    end;
    $$;
  `;
  assert.deepEqual(
    findDestructiveStatements(sql).map((finding) => finding.kind),
    ["drop column", "drop table", "rename", "column type change", "truncate"],
  );
  assert.deepEqual(findDestructiveStatements("create index i on public.t (a); grant select on public.t to anon;"), []);
});

test("diffNativeConfig ignores store versions and JS-only extra", () => {
  const base = {
    version: "1.1.2",
    runtimeVersion: "1.1.2",
    extra: { nativeBuildUpdates: { ios: { latestBuild: "18" } } },
    ios: { bundleIdentifier: "com.app", buildNumber: "18" },
    android: { versionCode: 1, package: "com.app" },
    plugins: ["expo-router"],
  };
  assert.deepEqual(
    diffNativeConfig(base, { ...base, version: "1.1.3", extra: {}, android: { ...base.android, versionCode: 2 } }),
    [],
  );
  assert.deepEqual(
    diffNativeConfig(base, {
      ...base,
      ios: { ...base.ios, associatedDomains: ["applinks:x"] },
      plugins: ["expo-router", "./plugins/x"],
    }),
    ["ios.associatedDomains", "plugins"],
  );
});

test("diffDependencies lists added and changed runtime dependencies", () => {
  assert.deepEqual(
    diffDependencies(
      { dependencies: { a: "1.0.0", b: "2.0.0", gone: "1.0.0" } },
      { dependencies: { a: "1.0.0", b: "2.1.0", c: "3.0.0" } },
    ),
    [
      { name: "b", from: "2.0.0", to: "2.1.0" },
      { name: "c", from: null, to: "3.0.0" },
    ],
  );
});

test("evaluateGuards blocks destructive SQL and native changes without a new runtime", () => {
  const destructive = baseAnalysis({
    migrations: ["supabase/migrations/1_x.sql"],
    destructive: [{ file: "supabase/migrations/1_x.sql", kind: "drop column", statement: "..." }],
  });
  assert.deepEqual(evaluateGuards(destructive).blockers, ["destructive-migration"]);
  assert.deepEqual(evaluateGuards(destructive, [LABEL_DESTRUCTIVE_OK]).blockers, []);

  const nativeSameRuntime = baseAnalysis({ areas: { web: false, mobile: true }, native: native({ nativeChange: true, configChanges: ["plugins"] }) });
  const blocked = evaluateGuards(nativeSameRuntime);
  assert.deepEqual(blocked.blockers, ["native-without-runtime"]);
  assert.equal(blocked.publishOta, false);
  const labelled = evaluateGuards(nativeSameRuntime, [LABEL_NATIVE_OTA_SAFE]);
  assert.equal(labelled.publishOta, true);
  assert.equal(labelled.storeBuildNeeded, true);

  const bumped = evaluateGuards(
    baseAnalysis({ areas: { web: false, mobile: true }, native: native({ nativeChange: true, runtimeHead: "1.1.3", runtimeBumped: true }) }),
  );
  assert.deepEqual(bumped.blockers, []);
  assert.equal(bumped.publishOta, true);
  assert.equal(bumped.storeBuildNeeded, true);

  const jsOnly = evaluateGuards(baseAnalysis({ areas: { web: true, mobile: true }, native: native() }));
  assert.deepEqual(jsOnly.blockers, []);
  assert.equal(jsOnly.publishOta, true);
  assert.equal(jsOnly.storeBuildNeeded, false);
});

test("reports carry their marker and summarize each release step", () => {
  const analysis = baseAnalysis({
    areas: { web: true, mobile: true },
    migrations: ["supabase/migrations/20261118000000_x.sql"],
    native: native(),
  });
  const guards = evaluateGuards(analysis);
  const pr = renderPrReport(analysis, guards, {
    DEV_OTA_RESULT: "success",
    DEV_OTA_GROUP: "group-1",
    EXPO_UPDATES_URL: "https://expo.dev/updates",
    HEAD_SHA: "c".repeat(40),
  });
  assert.ok(pr.startsWith(COMMENT_MARKER_PR));
  assert.match(pr, /https:\/\/expo\.dev\/updates\/group-1/);
  assert.match(pr, /migrations appliquées en prod → site déployé en prod → OTA publiée en prod\./);

  const release = renderReleaseReport(analysis, guards, {
    HEAD_SHA: "c".repeat(40),
    MIGRATE_RESULT: "success",
    WEB_RESULT: "failure",
    OTA_RESULT: "success",
    RUN_URL: "https://github.com/run/1",
  });
  assert.ok(release.startsWith(COMMENT_MARKER_RELEASE));
  assert.match(release, /Migrations\*\* : ✅ appliquées/);
  assert.match(release, /Web\*\* : ❌ failure/);
  assert.match(release, /Re-run failed jobs/);
  assert.doesNotMatch(release, /Build store/);
});
