import test from "node:test";
import assert from "node:assert/strict";

import {
  effectiveScope,
  findConflicts,
  matches,
  normalizePattern,
  outOfScope,
  patternsOverlap,
} from "./agent-scope.mjs";

const files = [
  "apps/mobile/package.json",
  "apps/mobile/components/RaceCard.tsx",
  "apps/mobile/components/racebook/RacebookTabBar.tsx",
  "apps/web/package.json",
  "apps/web/components/Button.tsx",
  "package.json",
  "supabase/migrations/20241215000000_create_app_feedback.sql",
];

test("normalizes Windows paths and directory shorthands", () => {
  assert.equal(normalizePattern(".\\apps\\mobile\\"), "apps/mobile/**");
});

test("matches literals as files or directories and globs per segment", () => {
  assert.ok(matches("apps/mobile", "apps/mobile/components/RaceCard.tsx"));
  assert.ok(!matches("apps/mob", "apps/mobile/components/RaceCard.tsx"));
  assert.ok(matches("apps/mobile/components/*.tsx", "apps/mobile/components/RaceCard.tsx"));
  assert.ok(!matches("apps/mobile/components/*.tsx", "apps/mobile/components/racebook/RacebookTabBar.tsx"));
  assert.ok(matches("apps/**/Button.tsx", "apps/web/components/Button.tsx"));
});

test("detects overlap between literal and glob patterns", () => {
  assert.ok(patternsOverlap("apps/mobile", "apps/mobile/components/*.tsx", files));
  assert.ok(patternsOverlap("apps/mobile/components/RaceCard.tsx", "apps/**", files));
  assert.ok(!patternsOverlap("apps/web/components/Button.tsx", "apps/mobile/**", files));
});

test("globs designating disjoint existing files do not overlap", () => {
  assert.ok(!patternsOverlap("apps/mobile/components/*.tsx", "apps/mobile/components/racebook/**", files));
  assert.ok(patternsOverlap("apps/mobile/**", "apps/mobile/components/racebook/**", files));
});

test("globs without existing files stay conservative", () => {
  assert.ok(patternsOverlap("apps/mobile/new/*.tsx", "apps/mobile/new/**", files));
});

test("a migration claim reserves the whole migrations folder", () => {
  const conflicts = findConflicts(
    ["supabase/migrations/20261111000000_a.sql"],
    [{ task: "other", patterns: ["supabase/migrations/20261111000001_b.sql"] }],
    files,
  );
  assert.equal(conflicts.length > 0, true);
});

test("a dependency manifest claim reserves every manifest", () => {
  assert.ok(effectiveScope(["apps/mobile/package.json"]).includes("package-lock.json"));
  const conflicts = findConflicts(
    ["apps/mobile/package.json"],
    [{ task: "web-deps", patterns: ["apps/web/package.json"] }],
    files,
  );
  assert.ok(conflicts.length > 0);
});

test("broad app claims do not reserve exclusive groups or block each other", () => {
  assert.deepEqual(effectiveScope(["apps/mobile/**"]), ["apps/mobile/**"]);
  assert.deepEqual(findConflicts(["apps/mobile/**"], [{ task: "web", patterns: ["apps/web/**"] }], files), []);
});

test("verify ignores docs and rejects files outside scope or in unreserved groups", () => {
  const issues = outOfScope(
    [
      "docs/01-architecture/mobile-app.md",
      "apps/mobile/components/RaceCard.tsx",
      "apps/mobile/package.json",
      "apps/web/components/Button.tsx",
    ],
    ["apps/mobile/**"],
  );
  assert.deepEqual(
    issues.map((issue) => issue.file),
    ["apps/mobile/package.json", "apps/web/components/Button.tsx"],
  );
  assert.deepEqual(outOfScope(["apps/mobile/package.json"], ["apps/mobile/**", "apps/mobile/package.json"]), []);
});
