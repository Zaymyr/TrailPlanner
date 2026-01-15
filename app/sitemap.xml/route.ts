import type { Locale } from "../../locales/types";
import { getAllPostMetadata } from "../../lib/blog/posts";
import { legacyPaths } from "../../lib/legacy-redirects";
import { HOME_PATH, RACE_PLANNER_PATH, SITE_URL } from "../seo";

type SitemapEntry = {
  path: string;
  lastModified?: string;
};

const locales: Locale[] = ["en", "fr"];

const sitemapEntries: SitemapEntry[] = [
  { path: HOME_PATH },
  { path: RACE_PLANNER_PATH },
  { path: `${RACE_PLANNER_PATH}/mobile` },
].filter((entry) => !legacyPaths.includes(entry.path as (typeof legacyPaths)[number]));

const toAbsoluteUrl = (path: string) => new URL(path, SITE_URL).toString();

const buildAlternateLinks = (path: string) =>
  locales
    .map(
      (locale) =>
        `<xhtml:link rel="alternate" hreflang="${locale}" href="${toAbsoluteUrl(path)}" />`,
    )
    .join("\n    ");

const buildUrlNode = ({ path, lastModified }: SitemapEntry) => {
  const lines = [
    "  <url>",
    `    <loc>${toAbsoluteUrl(path)}</loc>`,
    `    ${buildAlternateLinks(path)}`,
  ];

  if (lastModified) {
    lines.push(`    <lastmod>${lastModified}</lastmod>`);
  }

  lines.push("  </url>");

  return lines.join("\n");
};

export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const blogPosts = await getAllPostMetadata();

  const blogEntries: SitemapEntry[] = blogPosts.map((post) => ({
    path: `/blog/${post.slug}`,
    lastModified: post.updatedAt ?? post.date,
  }));

  const urlEntries = [...sitemapEntries, { path: "/blog" }, ...blogEntries].map(buildUrlNode).join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    urlEntries,
    "</urlset>",
  ].join("\n");

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
