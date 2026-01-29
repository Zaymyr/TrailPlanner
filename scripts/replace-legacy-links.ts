import { promises as fs } from "node:fs";
import path from "node:path";
import { legacyRedirectMap, legacyPaths } from "../lib/legacy-redirects.js";

const repoRoot = path.resolve(process.cwd());
const contentRoot = path.join(repoRoot, "content", "blog");
const shouldWrite = process.argv.includes("--write");
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pace-yourself.com";

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const collectMdxFiles = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMdxFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      files.push(fullPath);
    }
  }

  return files;
};

const replaceWithCount = (
  content: string,
  pattern: RegExp,
  replacement: string,
): { content: string; count: number } => {
  let count = 0;
  const nextContent = content.replace(pattern, (match, prefix) => {
    count += 1;
    return `${prefix}${replacement}`;
  });

  return { content: nextContent, count };
};

const buildPatterns = (legacyPath: string) => {
  const mappedPath = legacyRedirectMap[legacyPath as keyof typeof legacyRedirectMap];
  const legacyRelative = legacyPath.replace(/^\//, "");
  const mappedRelative = mappedPath.replace(/^\//, "");
  const legacyAbsolute = new URL(legacyPath, SITE_URL).toString();
  const mappedAbsolute = new URL(mappedPath, SITE_URL).toString();

  return [
    {
      label: legacyPath,
      pattern: new RegExp(`(\\]\\()${escapeRegExp(legacyPath)}(?=\\))`, "g"),
      replacement: mappedPath,
    },
    {
      label: legacyPath,
      pattern: new RegExp(`(href=["'])${escapeRegExp(legacyPath)}(?=["'])`, "g"),
      replacement: mappedPath,
    },
    {
      label: legacyRelative,
      pattern: new RegExp(`(\\]\\()${escapeRegExp(legacyRelative)}(?=\\))`, "g"),
      replacement: mappedRelative,
    },
    {
      label: legacyAbsolute,
      pattern: new RegExp(`(\\]\\()${escapeRegExp(legacyAbsolute)}(?=\\))`, "g"),
      replacement: mappedAbsolute,
    },
    {
      label: legacyAbsolute,
      pattern: new RegExp(`(href=["'])${escapeRegExp(legacyAbsolute)}(?=["'])`, "g"),
      replacement: mappedAbsolute,
    },
  ];
};

const replaceLegacyLinks = (content: string) => {
  let updatedContent = content;
  let totalCount = 0;

  legacyPaths.forEach((legacyPath) => {
    const patterns = buildPatterns(legacyPath);
    patterns.forEach(({ pattern, replacement }) => {
      const result = replaceWithCount(updatedContent, pattern, replacement);
      updatedContent = result.content;
      totalCount += result.count;
    });
  });

  return { content: updatedContent, count: totalCount };
};

const run = async () => {
  const files = await collectMdxFiles(contentRoot);
  const summary: Array<{ file: string; count: number }> = [];

  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    const { content: nextContent, count } = replaceLegacyLinks(content);

    if (count > 0) {
      summary.push({ file: path.relative(repoRoot, file), count });
      if (shouldWrite) {
        await fs.writeFile(file, nextContent);
      }
    }
  }

  if (summary.length === 0) {
    console.log("No legacy links found.");
    return;
  }

  summary.forEach(({ file, count }) => {
    console.log(`${shouldWrite ? "Updated" : "Found"} ${count} in ${file}`);
  });

  if (!shouldWrite) {
    console.log("Dry run complete. Re-run with --write to apply changes.");
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
