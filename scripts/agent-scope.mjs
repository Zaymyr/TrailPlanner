#!/usr/bin/env node
// File-scope reservations for parallel AI agents.
// See docs/06-workflows/agentic-development.md § "Parallel agent work".
//
// The registry lives in the shared Git directory (`<git-common-dir>/agent-scopes/`),
// so every worktree of this repository sees the same claims and nothing is committed.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// Documentation is shared by many code paths, so it is never part of a scope.
// Each branch edits the docs it needs; they are reconciled when branches are integrated.
export const DOCS_PREFIX = "docs/";

// Paths whose concurrent edits conflict even when two agents touch different files.
// Claiming any member of a group reserves the whole group.
export const EXCLUSIVE_GROUPS = [
  {
    name: "dependency manifests",
    patterns: [
      "package.json",
      "package-lock.json",
      "apps/*/package.json",
      "apps/*/package-lock.json",
      "packages/*/package.json",
    ],
  },
  { name: "supabase migrations", patterns: ["supabase/migrations/**"] },
  { name: "design tokens", patterns: ["packages/design-system/src/tokens/**"] },
  {
    name: "agent instructions",
    patterns: [
      "AGENTS.md",
      "CLAUDE.md",
      "GEMINI.md",
      ".github/copilot-instructions.md",
      ".codex/**",
      ".claude/agents/**",
    ],
  },
  {
    name: "CI and deployment config",
    patterns: [".github/workflows/**", "turbo.json", "vercel.json", "apps/mobile/eas.json"],
  },
];

const TASK_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function normalizePattern(value) {
  let pattern = value.trim().replaceAll("\\", "/").replace(/^\.\//, "");
  if (pattern.endsWith("/")) pattern = `${pattern}**`;
  return pattern;
}

export function isGlob(pattern) {
  return /[*?[]/.test(pattern);
}

export function staticPrefix(pattern) {
  const index = pattern.search(/[*?[]/);
  return index < 0 ? pattern : pattern.slice(0, index);
}

const regexCache = new Map();

export function globToRegExp(pattern) {
  const cached = regexCache.get(pattern);
  if (cached) return cached;
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        source += "(?:.*/)?";
        index += 2;
      } else {
        source += ".*";
        index += 1;
      }
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  const regex = new RegExp(`^${source}$`);
  regexCache.set(pattern, regex);
  return regex;
}

export function matches(pattern, file) {
  if (!isGlob(pattern)) return file === pattern || file.startsWith(`${pattern}/`);
  return globToRegExp(pattern).test(file);
}

function prefixesRelated(a, b) {
  const pa = staticPrefix(a);
  const pb = staticPrefix(b);
  return pa.startsWith(pb) || pb.startsWith(pa);
}

/**
 * Decide whether two scope patterns can designate the same file.
 * `knownFiles` (tracked + untracked paths) settles glob/glob comparisons;
 * when evidence is missing the answer is conservative.
 */
export function patternsOverlap(a, b, knownFiles = []) {
  if (!isGlob(a) && !isGlob(b)) return matches(a, b) || matches(b, a);
  if (!isGlob(a)) return matches(b, a) || (prefixesRelated(a, b) && b.startsWith(`${a}/`));
  if (!isGlob(b)) return matches(a, b) || (prefixesRelated(a, b) && a.startsWith(`${b}/`));
  if (!prefixesRelated(a, b)) return false;

  let aHasFile = false;
  let bHasFile = false;
  for (const file of knownFiles) {
    const inA = matches(a, file);
    const inB = matches(b, file);
    if (inA && inB) return true;
    aHasFile ||= inA;
    bHasFile ||= inB;
  }
  // Both globs already designate disjoint existing files: treat as independent.
  // Otherwise (a glob that matches nothing yet) stay conservative.
  return !(aHasFile && bHasFile);
}

/**
 * A pattern reserves an exclusive group only when it points inside the group
 * (e.g. `apps/mobile/package.json`, `supabase/migrations/2026*.sql`).
 * Broad patterns such as `apps/mobile/**` do not; `verify` then rejects any
 * change to a group member that was not reserved explicitly.
 */
export function touchesGroup(pattern, group) {
  const target = isGlob(pattern) ? staticPrefix(pattern).replace(/\/$/, "") : pattern;
  return group.patterns.some((member) => {
    if (matches(member, target)) return true;
    if (!member.endsWith("/**")) return false;
    const root = member.slice(0, -3);
    return target === root || target.startsWith(`${root}/`);
  });
}

export function touchedGroups(patterns) {
  return EXCLUSIVE_GROUPS.filter((group) => patterns.some((pattern) => touchesGroup(pattern, group)));
}

/** Patterns plus every exclusive group they reserve. */
export function effectiveScope(patterns) {
  const scope = new Set(patterns);
  for (const group of touchedGroups(patterns)) {
    for (const member of group.patterns) scope.add(member);
  }
  return [...scope];
}

export function findConflicts(patterns, claims, knownFiles = []) {
  const mine = effectiveScope(patterns);
  const conflicts = [];
  for (const claim of claims) {
    const theirs = effectiveScope(claim.patterns);
    for (const a of mine) {
      for (const b of theirs) {
        if (patternsOverlap(a, b, knownFiles)) conflicts.push({ task: claim.task, mine: a, theirs: b });
      }
    }
  }
  return conflicts;
}

/** Changed files the claim does not cover, with the reason. Docs are always allowed. */
export function outOfScope(files, patterns) {
  const scope = effectiveScope(patterns);
  const reserved = touchedGroups(patterns);
  const issues = [];
  for (const file of files) {
    if (file.startsWith(DOCS_PREFIX)) continue;
    if (!scope.some((pattern) => matches(pattern, file))) {
      issues.push({ file, reason: "not in scope" });
      continue;
    }
    const group = EXCLUSIVE_GROUPS.find(
      (candidate) =>
        !reserved.includes(candidate) && candidate.patterns.some((member) => matches(member, file)),
    );
    if (group) issues.push({ file, reason: `exclusive group "${group.name}" not reserved explicitly` });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// CLI

function git(args, cwd = process.cwd()) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function lines(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replaceAll("\\", "/"))
    .filter(Boolean);
}

function repositoryContext() {
  const worktree = git(["rev-parse", "--show-toplevel"]).replaceAll("\\", "/");
  const commonDir = resolve(worktree, git(["rev-parse", "--git-common-dir"]));
  const registry = resolve(commonDir, "agent-scopes");
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  return { worktree, registry, branch };
}

function knownFiles(worktree) {
  return [
    ...lines(git(["ls-files"], worktree)),
    ...lines(git(["ls-files", "--others", "--exclude-standard"], worktree)),
  ];
}

function registeredWorktrees() {
  return lines(git(["worktree", "list", "--porcelain"]))
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length).toLowerCase());
}

function readClaims(registry) {
  if (!existsSync(registry)) return [];
  return readdirSync(registry)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(resolve(registry, name), "utf8")));
}

function withLock(registry, action) {
  mkdirSync(registry, { recursive: true });
  const lock = resolve(registry, ".lock");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      writeFileSync(lock, String(process.pid), { flag: "wx" });
      try {
        return action();
      } finally {
        rmSync(lock, { force: true });
      }
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  throw new Error(`Registry locked (${lock}). Delete it if no scope command is running.`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parsePatterns(values) {
  const patterns = values.map(normalizePattern).filter(Boolean);
  const docs = patterns.filter((pattern) => pattern.startsWith(DOCS_PREFIX) || pattern === "docs");
  if (docs.length > 0) {
    fail(
      `Docs are never part of a scope (${docs.join(", ")}). Edit them freely and reconcile at integration.`,
    );
  }
  if (patterns.length === 0) fail("Provide at least one file, directory or glob.");
  return patterns;
}

function printConflicts(conflicts) {
  console.error("Scope overlaps with active claims:");
  for (const conflict of conflicts) {
    console.error(`- ${conflict.mine}  <->  ${conflict.theirs}  (task "${conflict.task}")`);
  }
}

function claim(task, values, { extend }) {
  if (!TASK_NAME.test(task ?? "")) fail("Task name must be kebab-case (a-z, 0-9, -).");
  const context = repositoryContext();
  const files = knownFiles(context.worktree);
  const patterns = parsePatterns(values);

  withLock(context.registry, () => {
    const claims = readClaims(context.registry);
    const existing = claims.find((entry) => entry.task === task);
    if (existing && !extend) fail(`Task "${task}" already has a claim. Use "extend" to widen it.`);
    if (!existing && extend) fail(`Task "${task}" has no claim. Use "claim" first.`);
    if (existing && existing.worktree.toLowerCase() !== context.worktree.toLowerCase()) {
      fail(`Task "${task}" belongs to worktree ${existing.worktree}.`);
    }

    const others = claims.filter((entry) => entry.task !== task);
    const sameWorktree = others.find(
      (entry) => entry.worktree.toLowerCase() === context.worktree.toLowerCase(),
    );
    if (sameWorktree) {
      fail(
        `Worktree ${context.worktree} already hosts task "${sameWorktree.task}". ` +
          "Parallel agents need one worktree each (see docs/06-workflows/agentic-development.md).",
      );
    }

    const nextPatterns = [...new Set([...(existing?.patterns ?? []), ...patterns])];
    const conflicts = findConflicts(nextPatterns, others, files);
    if (conflicts.length > 0) {
      printConflicts(conflicts);
      console.error("Ask the user before proceeding; do not edit these paths.");
      process.exit(1);
    }

    const record = {
      task,
      branch: context.branch,
      worktree: context.worktree,
      patterns: nextPatterns,
      claimedAt: existing?.claimedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(resolve(context.registry, `${task}.json`), `${JSON.stringify(record, null, 2)}\n`);
    console.log(`${extend ? "Extended" : "Claimed"} "${task}" on ${context.branch}:`);
    for (const pattern of effectiveScope(nextPatterns)) {
      console.log(`  ${pattern}${nextPatterns.includes(pattern) ? "" : "  (exclusive group)"}`);
    }
  });
}

function check(values) {
  const context = repositoryContext();
  const files = knownFiles(context.worktree);
  const patterns = parsePatterns(values);
  const conflicts = findConflicts(patterns, readClaims(context.registry), files);
  if (conflicts.length > 0) {
    printConflicts(conflicts);
    process.exit(1);
  }
  console.log("No overlap with active claims.");
}

function release(task) {
  const context = repositoryContext();
  withLock(context.registry, () => {
    const path = resolve(context.registry, `${task}.json`);
    if (!existsSync(path)) fail(`No claim named "${task}".`);
    rmSync(path);
    console.log(`Released "${task}".`);
  });
}

function list() {
  const context = repositoryContext();
  const worktrees = registeredWorktrees();
  const claims = readClaims(context.registry);
  if (claims.length === 0) {
    console.log("No active claims.");
    return;
  }
  for (const entry of claims) {
    const stale = !worktrees.includes(entry.worktree.toLowerCase()) ? "  [STALE: worktree missing]" : "";
    console.log(`${entry.task}  (${entry.branch} @ ${entry.worktree}, since ${entry.claimedAt})${stale}`);
    for (const pattern of entry.patterns) console.log(`  ${pattern}`);
  }
}

function prune() {
  const context = repositoryContext();
  const worktrees = registeredWorktrees();
  withLock(context.registry, () => {
    for (const entry of readClaims(context.registry)) {
      if (!worktrees.includes(entry.worktree.toLowerCase())) {
        rmSync(resolve(context.registry, `${entry.task}.json`));
        console.log(`Pruned "${entry.task}" (worktree ${entry.worktree} no longer exists).`);
      }
    }
  });
}

function verify(task, base) {
  const context = repositoryContext();
  const entry = readClaims(context.registry).find((item) => item.task === task);
  if (!entry) fail(`No claim named "${task}".`);
  const mergeBase = git(["merge-base", base, "HEAD"]);
  const changed = [
    ...new Set([
      ...lines(git(["diff", "--name-only", mergeBase])),
      ...lines(git(["ls-files", "--others", "--exclude-standard"])),
    ]),
  ];
  const outside = outOfScope(changed, entry.patterns);
  const docs = changed.filter((file) => file.startsWith(DOCS_PREFIX));

  if (docs.length > 0) {
    console.log("Docs changed on this branch (reconcile with other branches at integration):");
    for (const file of docs) console.log(`  ${file}`);
  }
  if (outside.length > 0) {
    console.error(`Files changed outside the "${task}" scope:`);
    for (const issue of outside) console.error(`- ${issue.file} (${issue.reason})`);
    console.error('Run "extend" for each needed path (it fails on overlap) or revert them.');
    process.exit(1);
  }
  console.log(`All ${changed.length - docs.length} code change(s) are inside the "${task}" scope.`);
}

const USAGE = `Usage: node scripts/agent-scope.mjs <command>
  list                              Show active claims
  check <path|glob>...              Dry-run overlap check
  claim <task> <path|glob>...       Reserve a scope for this worktree
  extend <task> <path|glob>...      Widen an existing claim (fails on overlap)
  verify <task> [--base <ref>]      Ensure changed files stay inside the scope (default base origin/main)
  release <task>                    Drop the claim when the task is integrated or abandoned
  prune                             Drop claims whose worktree no longer exists`;

function main(argv) {
  const [command, ...rest] = argv;
  switch (command) {
    case "list":
      return list();
    case "check":
      return check(rest);
    case "claim":
      return claim(rest[0], rest.slice(1), { extend: false });
    case "extend":
      return claim(rest[0], rest.slice(1), { extend: true });
    case "verify": {
      const baseIndex = rest.indexOf("--base");
      return verify(rest[0], baseIndex >= 0 ? rest[baseIndex + 1] : "origin/main");
    }
    case "release":
      return release(rest[0]);
    case "prune":
      return prune();
    default:
      console.log(USAGE);
      process.exitCode = command ? 1 : 0;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
