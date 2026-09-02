import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";
import { describe, expect, it } from "vitest";

import { blogRedirectMap } from "./blog/redirects";
import { legacyRedirectMap } from "./legacy-redirects";

const WEB_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const APP_DIRECTORY = path.join(WEB_DIRECTORY, "app");
const BLOG_DIRECTORY = path.join(WEB_DIRECTORY, "content", "blog");

const listFilesRecursively = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    return entry.isDirectory() ? listFilesRecursively(entryPath) : [entryPath];
  });

const getStaticAppRoutes = (): Set<string> =>
  new Set(
    listFilesRecursively(APP_DIRECTORY)
      .filter((filePath) => path.basename(filePath) === "page.tsx")
      .map((filePath) =>
        path.relative(APP_DIRECTORY, path.dirname(filePath)).replace(/\\/g, "/"),
      )
      .filter((routePath) => !routePath.includes("["))
      .map((routePath) => {
        const publicSegments = routePath
          .split("/")
          .filter(Boolean)
          .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));

        return `/${publicSegments.join("/")}`;
      }),
  );

const getPublishedBlogRoutes = (): Set<string> =>
  new Set(
    listFilesRecursively(BLOG_DIRECTORY)
      .filter(
        (filePath) =>
          /\.mdx?$/.test(filePath) &&
          path.basename(filePath).toLowerCase() !== "readme.md",
      )
      .map((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        const canonical = matter(source).data.canonical;
        const relativePath = path.relative(BLOG_DIRECTORY, filePath).replace(/\\/g, "/");
        const slug = relativePath
          .replace(/\.mdx?$/, "")
          .split("/")
          .map((segment) =>
            segment
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, ""),
          )
          .filter(Boolean)
          .join("/");

        return typeof canonical === "string" && canonical.startsWith("/blog/")
          ? canonical
          : `/blog/${slug}`;
      }),
  );

describe("redirect integrity", () => {
  it("only redirects to existing public pages", () => {
    const existingRoutes = new Set([...getStaticAppRoutes(), ...getPublishedBlogRoutes()]);
    const redirectMap = { ...legacyRedirectMap, ...blogRedirectMap };
    const missingTargets = Object.entries(redirectMap)
      .filter(([, target]) => !existingRoutes.has(target))
      .map(([source, target]) => `${source} -> ${target}`);

    expect(missingTargets).toEqual([]);
  });

  it("does not introduce redirect chains", () => {
    const redirectMap = { ...legacyRedirectMap, ...blogRedirectMap };
    const redirectSources = new Set(Object.keys(redirectMap));
    const chainedRedirects = Object.entries(redirectMap)
      .filter(([, target]) => redirectSources.has(target))
      .map(([source, target]) => `${source} -> ${target}`);

    expect(chainedRedirects).toEqual([]);
  });
});
