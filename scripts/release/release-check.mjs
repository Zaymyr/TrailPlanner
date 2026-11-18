#!/usr/bin/env node
// Release guards and status reports for the "one PR = one task, merge = production" flow.
//
// Commands (run from the repository root):
//   changes  --base <ref> --head <ref> --out <file>   git-only analysis (areas, migrations, destructive SQL)
//   native   --base <ref> --analysis <file>           adds the native analysis (needs apps/mobile/node_modules)
//   evaluate --analysis <file> [--labels a,b]         writes GitHub outputs, exits 1 when a guard blocks
//   report   --mode pr|release --analysis <file>      prints the Markdown status comment (results from env)
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LABEL_DESTRUCTIVE_OK = "migration-destructive-ok";
export const LABEL_NATIVE_OTA_SAFE = "native-ota-safe";
export const COMMENT_MARKER_PR = "<!-- release-status:pr -->";
export const COMMENT_MARKER_RELEASE = "<!-- release-status:release -->";

const WEB_INPUTS = ["apps/web/", "packages/", "package.json", "package-lock.json", "turbo.json", "vercel.json"];
const MOBILE_INPUTS = ["apps/mobile/", "packages/", "package.json", "package-lock.json"];
const MIGRATION_PATTERN = /^supabase\/migrations\/[^/]+\.sql$/;
const MOBILE_EXCLUDED = [/^apps\/mobile\/\.eas\//, /\.md$/];

const matchesInput = (file, inputs) =>
  inputs.some((input) => (input.endsWith("/") ? file.startsWith(input) : file === input));

/** Classifies changed paths into the three release areas. */
export function classifyPaths(files) {
  const migrations = files.filter((file) => MIGRATION_PATTERN.test(file));
  return {
    web: files.some((file) => matchesInput(file, WEB_INPUTS)),
    mobile: files.some(
      (file) => matchesInput(file, MOBILE_INPUTS) && !MOBILE_EXCLUDED.some((pattern) => pattern.test(file)),
    ),
    migrations,
  };
}

const stripSqlComments = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
// Function and DO bodies run later (and are reviewed as code), not as schema changes of this migration.
const stripDollarQuotedBodies = (sql) => sql.replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, " ");

const DESTRUCTIVE_PATTERNS = [
  { kind: "drop table", pattern: /\bdrop\s+table\b/i },
  { kind: "drop schema", pattern: /\bdrop\s+schema\b/i },
  { kind: "drop column", pattern: /\bdrop\s+column\b/i },
  { kind: "truncate", pattern: /\btruncate\b/i },
  { kind: "delete", pattern: /\bdelete\s+from\b/i },
  { kind: "rename", pattern: /\brename\s+(?:column\s+)?\S+\s+to\b|\brename\s+to\b/i },
  { kind: "column type change", pattern: /\balter\s+column\s+\S+\s+(?:set\s+data\s+)?type\b/i },
];

/**
 * Finds statements that can lose data or break the previous app/web version.
 * Additive changes (create, add column, create or replace function, policies, grants) are not flagged.
 */
export function findDestructiveStatements(sql) {
  return stripDollarQuotedBodies(stripSqlComments(sql))
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .flatMap((statement) => {
      const match = DESTRUCTIVE_PATTERNS.find(({ pattern }) => pattern.test(statement));
      return match ? [{ kind: match.kind, statement: statement.slice(0, 160) }] : [];
    });
}

const IGNORED_CONFIG_PATHS = new Set([
  "version",
  "description",
  "extra",
  "runtimeVersion",
  "android.runtimeVersion",
  "ios.runtimeVersion",
  "android.versionCode",
  "ios.buildNumber",
  "android.playStoreUrl",
  "ios.appStoreUrl",
]);

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Lists the config paths (two levels deep) whose value changed, ignoring store-version and JS-only fields. */
export function diffNativeConfig(base, head, prefix = "", depth = 0) {
  const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(head ?? {})]);
  const changed = [];
  for (const key of [...keys].sort()) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    if (IGNORED_CONFIG_PATHS.has(keyPath)) continue;
    const before = base?.[key];
    const after = head?.[key];
    if (depth < 1 && isPlainObject(before) && isPlainObject(after)) {
      changed.push(...diffNativeConfig(before, after, keyPath, depth + 1));
    } else if (JSON.stringify(before) !== JSON.stringify(after)) {
      changed.push(keyPath);
    }
  }
  return changed;
}

/** Compares `dependencies` of two package.json objects. */
export function diffDependencies(basePackage, headPackage) {
  const before = basePackage?.dependencies ?? {};
  const after = headPackage?.dependencies ?? {};
  return Object.keys(after)
    .filter((name) => before[name] !== after[name])
    .sort()
    .map((name) => ({ name, from: before[name] ?? null, to: after[name] }));
}

/** Decides what a change may do. `labels` are the PR labels. */
export function evaluateGuards(analysis, labels = []) {
  const blockers = [];
  const destructiveOk = labels.includes(LABEL_DESTRUCTIVE_OK);
  const nativeOtaSafe = labels.includes(LABEL_NATIVE_OTA_SAFE);
  const native = analysis.native ?? null;

  if (analysis.destructive.length > 0 && !destructiveOk) {
    blockers.push("destructive-migration");
  }
  const nativeChange = Boolean(native?.nativeChange);
  const runtimeBumped = Boolean(native?.runtimeBumped);
  if (nativeChange && !runtimeBumped && !nativeOtaSafe) {
    blockers.push("native-without-runtime");
  }

  return {
    blockers,
    destructiveOk,
    nativeOtaSafe,
    nativeChange,
    runtimeBumped,
    storeBuildNeeded: nativeChange,
    publishOta: analysis.areas.mobile && !(nativeChange && !runtimeBumped && !nativeOtaSafe),
  };
}

const yes = (value) => (value ? "true" : "false");

const statusIcon = (result) =>
  ({ success: "✅", failure: "❌", cancelled: "⏹️", skipped: "➖" })[result] ?? "⏳";

function renderGuards(analysis, guards) {
  const lines = [];
  if (analysis.migrations.length === 0) {
    lines.push("- **Migrations** : aucune");
  } else {
    const names = analysis.migrations.map((file) => `\`${path.basename(file)}\``);
    const shown = names.length > 6 ? [...names.slice(0, 6), `et ${names.length - 6} autres`] : names;
    lines.push(`- **Migrations** (${names.length}) : ${shown.join(", ")}`);
    if (analysis.destructive.length > 0) {
      const verdict = guards.destructiveOk
        ? `autorisée par le label \`${LABEL_DESTRUCTIVE_OK}\``
        : `**bloquant** : vérifie que l’ancienne version du site et de l’app supporte ce changement, puis ajoute le label \`${LABEL_DESTRUCTIVE_OK}\``;
      lines.push(`  - ⚠️ Opération destructive (${verdict})`);
      for (const finding of analysis.destructive) {
        lines.push(`    - \`${path.basename(finding.file)}\` · ${finding.kind} : \`${finding.statement}\``);
      }
    }
  }

  const native = analysis.native;
  if (!analysis.areas.mobile) {
    lines.push("- **Natif** : app mobile non modifiée");
  } else if (!native) {
    lines.push("- **Natif** : non analysé");
  } else if (!native.nativeChange) {
    lines.push(`- **Natif** : aucun changement, l’OTA suffit (runtime \`${native.runtimeHead}\`)`);
  } else {
    const details = [
      ...native.nativeDependencies.map((dep) => `dépendance \`${dep.name}\` ${dep.from ?? "ajoutée"} → ${dep.to}`),
      ...native.configChanges.map((key) => `config \`${key}\``),
      ...native.pluginChanges.map((file) => `plugin \`${file}\``),
    ];
    let verdict;
    if (native.runtimeBumped) {
      verdict = `runtime \`${native.runtimeBase}\` → \`${native.runtimeHead}\` : **build store nécessaire après fusion**, l’OTA de prod ira au nouveau runtime`;
    } else if (guards.nativeOtaSafe) {
      verdict = `déclaré compatible OTA par le label \`${LABEL_NATIVE_OTA_SAFE}\` : runtime \`${native.runtimeHead}\` conservé, un build store reste nécessaire pour activer le natif`;
    } else {
      verdict = `**bloquant** : monte \`runtimeVersion\` dans \`apps/mobile/app.config.ts\` (build store après fusion) ou, si le JS ne dépend pas de ce natif, ajoute le label \`${LABEL_NATIVE_OTA_SAFE}\``;
    }
    lines.push(`- **Natif** : changement détecté (${details.join(" ; ")})`);
    lines.push(`  - ${verdict}`);
  }
  return lines;
}

export function renderPrReport(analysis, guards, env = {}) {
  const lines = [COMMENT_MARKER_PR, "## État de la PR", ""];
  lines.push(
    analysis.areas.web
      ? "- **Web** : modifié · Preview Vercel dans le commentaire Vercel de cette PR"
      : "- **Web** : non modifié",
  );
  if (!analysis.areas.mobile) {
    lines.push("- **App Dev (OTA)** : app mobile non modifiée");
  } else if (env.DEV_OTA_RESULT === "skipped" && env.PREVIOUS_OTA_LINE) {
    // Label-only runs do not republish: keep the line from the last code push.
    lines.push(env.PREVIOUS_OTA_LINE);
  } else if (env.DEV_OTA_RESULT === "success" && env.DEV_OTA_GROUP) {
    lines.push(
      `- **App Dev (OTA)** : ✅ publiée sur le canal \`development\` · [voir la mise à jour](${env.EXPO_UPDATES_URL}/${env.DEV_OTA_GROUP}) · relance « Pace Yourself Dev » pour la charger`,
    );
  } else {
    lines.push(`- **App Dev (OTA)** : ${statusIcon(env.DEV_OTA_RESULT)} ${env.DEV_OTA_RESULT || "en attente"}${env.RUN_URL ? ` · [logs](${env.RUN_URL})` : ""}`);
  }
  lines.push(...renderGuards(analysis, guards));
  lines.push("", "### À la fusion");
  const steps = [];
  if (analysis.migrations.length > 0) steps.push("migrations appliquées en prod");
  if (analysis.areas.web) steps.push("site déployé en prod");
  if (guards.publishOta) steps.push("OTA publiée en prod");
  if (guards.storeBuildNeeded) steps.push("**puis build store à lancer**");
  lines.push(steps.length > 0 ? `${steps.join(" → ")}.` : "rien à déployer (docs ou outillage uniquement).");
  if (guards.blockers.length > 0) {
    lines.push("", "**Fusion bloquée** tant que les points marqués « bloquant » ne sont pas réglés.");
  }
  if (env.HEAD_SHA) lines.push("", `<sub>Commit \`${env.HEAD_SHA.slice(0, 8)}\`${env.RUN_URL ? ` · [run](${env.RUN_URL})` : ""}</sub>`);
  return `${lines.join("\n")}\n`;
}

export function renderReleaseReport(analysis, guards, env = {}) {
  const sha = env.HEAD_SHA ?? "";
  const lines = [COMMENT_MARKER_RELEASE, `## Release prod · \`${sha.slice(0, 8)}\``, ""];
  const migrate = env.MIGRATE_RESULT || "skipped";
  lines.push(
    analysis.migrations.length === 0
      ? "- **Migrations** : aucune"
      : `- **Migrations** : ${statusIcon(migrate)} ${migrate === "success" ? "appliquées" : migrate} (${analysis.migrations.length})`,
  );
  const web = env.WEB_RESULT || "skipped";
  if (!analysis.areas.web) {
    lines.push("- **Web** : non modifié");
  } else if (web === "success") {
    lines.push(`- **Web** : ✅ en prod${env.WEB_URL ? ` · [déploiement](${env.WEB_URL})` : ""} · https://pace-yourself.com`);
  } else {
    lines.push(`- **Web** : ${statusIcon(web)} ${web === "skipped" ? "non lancé (étape précédente en échec)" : web}`);
  }
  const ota = env.OTA_RESULT || "skipped";
  if (!analysis.areas.mobile) {
    lines.push("- **OTA prod** : app mobile non modifiée");
  } else if (!guards.publishOta) {
    lines.push("- **OTA prod** : ⛔ bloquée, changement natif sans nouveau runtime ni label");
  } else if (ota === "success") {
    lines.push(`- **OTA prod** : ✅ publiée (runtime \`${analysis.native?.runtimeHead ?? "?"}\`)`);
  } else {
    lines.push(`- **OTA prod** : ${statusIcon(ota)} ${ota === "skipped" ? "non lancée (étape précédente en échec)" : ota}`);
  }
  if (guards.storeBuildNeeded) {
    lines.push(
      "- **Build store** : nécessaire. Depuis `apps/mobile` :",
      `  \`eas workflow:run .eas/workflows/store-candidate-ios.yml --ref ${sha}\` (et \`store-candidate-android.yml\`)`,
    );
  }
  const failed = [migrate, web, ota].includes("failure");
  lines.push("", failed ? `**Échec** : ouvre le [run](${env.RUN_URL}) puis « Re-run failed jobs ».` : `[Run](${env.RUN_URL})`);
  return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith("--")) {
      args[token.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[(index += 1)] : "true";
    }
  }
  return args;
}

function writeOutputs(outputs) {
  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
  console.log(lines.join("\n"));
}

function commandChanges(args) {
  const base = git(["merge-base", args.base, args.head]).trim();
  const files = git(["diff", "--name-only", "--diff-filter=ACMRD", base, args.head]).split("\n").filter(Boolean);
  const { web, mobile, migrations } = classifyPaths(files);
  const addedOrChanged = git(["diff", "--name-only", "--diff-filter=ACMR", base, args.head, "--", "supabase/migrations"])
    .split("\n")
    .filter((file) => MIGRATION_PATTERN.test(file));
  const destructive = addedOrChanged.flatMap((file) =>
    findDestructiveStatements(git(["show", `${args.head}:${file}`])).map((finding) => ({ file, ...finding })),
  );
  const analysis = { base, head: git(["rev-parse", args.head]).trim(), areas: { web, mobile }, migrations, destructive, native: null };
  writeFileSync(args.out, JSON.stringify(analysis, null, 2));
  writeOutputs({ web: yes(web), mobile: yes(mobile), migrations: yes(migrations.length > 0) });
}

const NATIVE_MARKERS = ["ios", "android", "expo-module.config.json", "app.plugin.js"];

function hasNativeCode(mobileRoot, name) {
  const require = createRequire(path.join(mobileRoot, "package.json"));
  let packageDir;
  try {
    packageDir = path.dirname(require.resolve(`${name}/package.json`));
  } catch {
    return true; // Unresolvable: assume native rather than risk an incompatible OTA.
  }
  return (
    NATIVE_MARKERS.some((marker) => existsSync(path.join(packageDir, marker))) ||
    readdirSync(packageDir).some((entry) => entry.endsWith(".podspec"))
  );
}

function loadExpoConfig(mobileRoot, projectRoot) {
  const require = createRequire(path.join(mobileRoot, "package.json"));
  const { getConfig } = require("@expo/config");
  return getConfig(projectRoot, { skipSDKVersionRequirement: true, isPublicConfig: true }).exp;
}

function commandNative(args) {
  const analysis = JSON.parse(readFileSync(args.analysis, "utf8"));
  const repoRoot = process.cwd();
  const mobileRoot = path.join(repoRoot, "apps/mobile");
  const base = analysis.base;
  const head = analysis.head;
  const show = (file) => {
    try {
      return git(["show", `${base}:${file}`]);
    } catch {
      return null;
    }
  };

  const basePackage = JSON.parse(show("apps/mobile/package.json") ?? "{}");
  const headPackage = JSON.parse(readFileSync(path.join(mobileRoot, "package.json"), "utf8"));
  const nativeDependencies = diffDependencies(basePackage, headPackage).filter((dep) => hasNativeCode(mobileRoot, dep.name));

  const pluginChanges = git(["diff", "--name-only", base, head, "--", "apps/mobile/plugins", "apps/mobile/patches"])
    .split("\n")
    .filter(Boolean);

  // Rebuild the base project config next to the real one so it resolves the same node_modules.
  const baseRoot = path.join(mobileRoot, ".release-check-base");
  rmSync(baseRoot, { recursive: true, force: true });
  mkdirSync(baseRoot, { recursive: true });
  let configChanges;
  let runtimeBase = null;
  let runtimeHead = null;
  try {
    for (const file of git(["ls-tree", "-r", "--name-only", base, "--", "apps/mobile/app.config.ts", "apps/mobile/app.json", "apps/mobile/package.json", "apps/mobile/plugins"]).split("\n").filter(Boolean)) {
      const target = path.join(baseRoot, path.relative("apps/mobile", file));
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, show(file) ?? "");
    }
    const headConfig = loadExpoConfig(mobileRoot, mobileRoot);
    runtimeHead = String(headConfig.runtimeVersion ?? "");
    try {
      const baseConfig = loadExpoConfig(mobileRoot, baseRoot);
      runtimeBase = String(baseConfig.runtimeVersion ?? "");
      configChanges = diffNativeConfig(baseConfig, headConfig);
    } catch (error) {
      console.warn(`Base Expo config could not be evaluated: ${error.message}`);
      configChanges = ["(config de base illisible)"];
    }
  } finally {
    rmSync(baseRoot, { recursive: true, force: true });
  }

  analysis.native = {
    nativeDependencies,
    configChanges,
    pluginChanges,
    runtimeBase,
    runtimeHead,
    runtimeBumped: Boolean(runtimeBase && runtimeHead && runtimeBase !== runtimeHead),
    nativeChange: nativeDependencies.length > 0 || configChanges.length > 0 || pluginChanges.length > 0,
  };
  writeFileSync(args.analysis, JSON.stringify(analysis, null, 2));
  console.log(JSON.stringify(analysis.native, null, 2));
}

function readLabels(args) {
  return (args.labels ?? process.env.PR_LABELS ?? "").split(",").map((label) => label.trim()).filter(Boolean);
}

function commandEvaluate(args) {
  const analysis = JSON.parse(readFileSync(args.analysis, "utf8"));
  const guards = evaluateGuards(analysis, readLabels(args));
  writeOutputs({
    publish_ota: yes(guards.publishOta),
    store_build_needed: yes(guards.storeBuildNeeded),
    blocked: yes(guards.blockers.length > 0),
  });
  if (args.enforce === "true" && guards.blockers.length > 0) {
    for (const blocker of guards.blockers) console.log(`::error::Release guard blocked: ${blocker}`);
    process.exit(1);
  }
}

function commandReport(args) {
  const analysis = JSON.parse(readFileSync(args.analysis, "utf8"));
  const guards = evaluateGuards(analysis, readLabels(args));
  const render = args.mode === "release" ? renderReleaseReport : renderPrReport;
  process.stdout.write(render(analysis, guards, process.env));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const commands = { changes: commandChanges, native: commandNative, evaluate: commandEvaluate, report: commandReport };
  if (!commands[command]) {
    console.error(`Usage: release-check.mjs <${Object.keys(commands).join("|")}> [options]`);
    process.exit(2);
  }
  commands[command](args);
}
