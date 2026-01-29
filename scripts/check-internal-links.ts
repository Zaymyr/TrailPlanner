import { promises as fs } from "node:fs";
import path from "node:path";
import { blogIndex } from "../content/blog/index.js";
import { legacyRedirectMap, legacyPaths } from "../lib/legacy-redirects.js";

const repoRoot = path.resolve(process.cwd());
const contentRoot = path.join(repoRoot, "content", "blog");
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pace-yourself.com";

const legacyPathSet = new Set<string>(legacyPaths);
const blogSlugSet = new Set<string>(blogIndex.map((entry) => entry.slug));

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

const extractLinks = (content: string): string[] => {
  const links: string[] = [];
  const markdownLinkRegex = /\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const hrefRegex = /href=["']([^"']+)["']/g;

  let match: RegExpExecArray | null;
  while ((match = markdownLinkRegex.exec(content)) !== null) {
    links.push(match[1]);
  }

  while ((match = hrefRegex.exec(content)) !== null) {
    links.push(match[1]);
  }

  return links;
};

const normalizeInternalPath = (link: string): string | null => {
  if (link.startsWith("#") || link.startsWith("mailto:")) {
    return null;
  }

  if (link.startsWith("http://") || link.startsWith("https://")) {
    try {
      const url = new URL(link);
      const siteOrigin = new URL(SITE_URL).origin;
      if (url.origin !== siteOrigin) {
        return null;
      }
      return url.pathname;
    } catch {
      return null;
    }
  }

  if (link.startsWith("/")) {
    return link;
  }

  return link;
};

const normalizePathname = (pathname: string): string =>
  pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;

const validateLinks = async () => {
  const files = await collectMdxFiles(contentRoot);
  const issues: string[] = [];

  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    const links = extractLinks(content);
    const relativeFile = path.relative(repoRoot, file);

    links.forEach((link) => {
      const pathname = normalizeInternalPath(link);
      if (!pathname) {
        return;
      }

      const normalized = normalizePathname(pathname);
      const legacyPath = normalized.startsWith("/")
        ? normalized
        : `/${normalized.replace(/^\//, "")}`;

      if (legacyPathSet.has(legacyPath)) {
        issues.push(`${relativeFile}: legacy link "${link}" -> "${legacyPath}"`);
        return;
      }

      if (normalized.startsWith("/blog/")) {
        const slug = normalized.replace("/blog/", "").split("/")[0];
        if (!blogSlugSet.has(slug)) {
          issues.push(`${relativeFile}: missing blog slug "${slug}" in "${link}"`);
        }
      }
    });
  }

  blogIndex.forEach((entry) => {
    entry.related?.forEach((relatedSlug) => {
      if (!blogSlugSet.has(relatedSlug)) {
        issues.push(`content/blog/index.ts: related slug missing "${entry.slug}" -> "${relatedSlug}"`);
      }
    });
  });

  Object.entries(legacyRedirectMap).forEach(([legacyPath, targetPath]) => {
    if (!targetPath.startsWith("/blog/") || !blogSlugSet.has(targetPath.replace("/blog/", ""))) {
      issues.push(`legacy redirect target invalid: "${legacyPath}" -> "${targetPath}"`);
    }
  });

  if (issues.length > 0) {
    console.error("Broken internal links detected:");
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
  } else {
    console.log("Internal link check passed.");
  }
};

validateLinks().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
