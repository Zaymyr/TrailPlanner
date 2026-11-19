import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  effectiveScope,
  findConflicts,
  matches,
  normalizePattern,
  outOfScope,
  patternsOverlap,
  processIsAlive,
  ScopeError,
  withLock,
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

function tempRegistry() {
  const registry = mkdtempSync(join(tmpdir(), "agent-scope-"));
  return { registry, lock: join(registry, ".lock") };
}

function deadPid() {
  const child = spawnSync(process.execPath, ["-e", ""]);
  assert.equal(child.status, 0);
  return child.pid;
}

test("a failing locked action still releases the lock", () => {
  const { registry, lock } = tempRegistry();
  try {
    assert.throws(
      () =>
        withLock(registry, () => {
          throw new ScopeError("overlap");
        }),
      ScopeError,
    );
    assert.equal(existsSync(lock), false);
  } finally {
    rmSync(registry, { recursive: true, force: true });
  }
});

test("a lock left by a process that is gone is reclaimed", () => {
  const { registry, lock } = tempRegistry();
  try {
    const pid = deadPid();
    assert.equal(processIsAlive(pid), false);
    writeFileSync(lock, String(pid));
    assert.equal(withLock(registry, () => "done", { attempts: 2, waitMs: 1 }), "done");
    assert.equal(existsSync(lock), false);
  } finally {
    rmSync(registry, { recursive: true, force: true });
  }
});

test("a lock held by a running process is respected", () => {
  const { registry, lock } = tempRegistry();
  try {
    assert.equal(processIsAlive(process.ppid), true);
    writeFileSync(lock, String(process.ppid));
    assert.throws(
      () => withLock(registry, () => "never", { attempts: 2, waitMs: 1 }),
      (error) => error instanceof ScopeError && /Registry locked/.test(error.message),
    );
    assert.equal(existsSync(lock), true);
  } finally {
    rmSync(registry, { recursive: true, force: true });
  }
});

test("an unreadable lock is only reclaimed once it is old", () => {
  const { registry, lock } = tempRegistry();
  try {
    writeFileSync(lock, "");
    const options = { attempts: 2, waitMs: 1 };
    assert.throws(() => withLock(registry, () => "never", options), ScopeError);
    const old = new Date(Date.now() - 60_000);
    utimesSync(lock, old, old);
    assert.equal(withLock(registry, () => "done", options), "done");
  } finally {
    rmSync(registry, { recursive: true, force: true });
  }
});

test("a rejected CLI command exits 1 without leaving the registry locked", () => {
  const repo = mkdtempSync(join(tmpdir(), "agent-scope-repo-"));
  const script = resolve(fileURLToPath(new URL(".", import.meta.url)), "agent-scope.mjs");
  try {
    execFileSync("git", ["init", "-q"], { cwd: repo });
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "init"], {
      cwd: repo,
    });
    const result = spawnSync(process.execPath, [script, "release", "missing-task"], { cwd: repo, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /No claim named "missing-task"/);
    assert.equal(existsSync(join(repo, ".git", "agent-scopes", ".lock")), false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
