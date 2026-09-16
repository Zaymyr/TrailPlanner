import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import process from "node:process";

const repositoryRoot = resolve(import.meta.dirname, "..");
const docsRoot = resolve(repositoryRoot, "docs");

function normalizePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "_archive" ? [] : markdownFiles(absolutePath);
    }
    return entry.isFile() && entry.name.endsWith(".md") ? [absolutePath] : [];
  });
}

function relatedFilesFor(documentPath) {
  const source = readFileSync(documentPath, "utf8");
  const frontmatter = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) return [];

  const lines = frontmatter[1].split(/\r?\n/);
  const relatedFiles = [];
  let inRelatedFiles = false;

  for (const line of lines) {
    if (/^related_files:\s*$/.test(line)) {
      inRelatedFiles = true;
      continue;
    }
    if (inRelatedFiles && /^\S/.test(line)) break;

    const item = inRelatedFiles ? line.match(/^\s+-\s+(.+?)\s*$/) : null;
    if (item) {
      relatedFiles.push(normalizePath(item[1].replace(/^['"]|['"]$/g, "")));
    }
  }

  return relatedFiles;
}

function commandOutput(command, args) {
  return execFileSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function changedFiles() {
  const base = argumentValue("--base");
  const committed = base
    ? commandOutput("git", ["diff", "--name-only", `${base}...HEAD`])
    : commandOutput("git", ["diff", "--name-only", "HEAD"]);
  const untracked = commandOutput("git", ["ls-files", "--others", "--exclude-standard"]);

  return new Set(
    `${committed}\n${untracked}`
      .split(/\r?\n/)
      .map(normalizePath)
      .filter(Boolean),
  );
}

const references = new Map();
const missingReferences = [];

for (const documentPath of markdownFiles(docsRoot)) {
  const document = normalizePath(relative(repositoryRoot, documentPath));
  for (const relatedFile of relatedFilesFor(documentPath)) {
    if (!existsSync(resolve(repositoryRoot, relatedFile))) {
      missingReferences.push(`${document} -> ${relatedFile}`);
    }
    const documents = references.get(relatedFile) ?? [];
    documents.push(document);
    references.set(relatedFile, documents);
  }
}

const changed = changedFiles();
const missingDocUpdates = [];

for (const changedFile of changed) {
  for (const document of references.get(changedFile) ?? []) {
    if (!changed.has(document)) {
      missingDocUpdates.push(`${changedFile} requires ${document}`);
    }
  }
}

if (missingReferences.length > 0) {
  console.error("Documentation contains related_files paths that do not exist:");
  for (const issue of missingReferences) console.error(`- ${issue}`);
}

if (missingDocUpdates.length > 0) {
  console.error("Changed files require documentation updates in the same change:");
  for (const issue of missingDocUpdates) console.error(`- ${issue}`);
}

if (missingReferences.length > 0 || missingDocUpdates.length > 0) {
  process.exitCode = 1;
} else {
  console.log(`Documentation protocol satisfied for ${changed.size} changed file(s).`);
}
