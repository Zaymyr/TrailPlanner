import { SITE_URL } from "../seo";
import type { Locale } from "../../locales/types";

type SitemapEntry = {
  path: string;
  lastModified?: string;
};

const locales: Locale[] = ["en", "fr"];

const sitemapEntries: SitemapEntry[] = [
  { path: "/" },
  { path: "/race-planner" },
  { path: "/race-planner/mobile" },
];

const toAbsoluteUrl = (path: string) => new URL(path, SITE_URL).toString();

const buildAlternateLinks = (path: string) =>
  locales
    .map(
      (locale) =>
        `<xhtml:link rel="alternate" hreflang="${locale}" href="${toAbsoluteUrl(path)}" />`,
    )
    .join("\n    ");

const buildUrlNode = ({ path, lastModified }: SitemapEntry) => {
  const lastmod = lastModified ?? new Date().toISOString();

  return [
    "  <url>",
    `    <loc>${toAbsoluteUrl(path)}</loc>`,
    `    ${buildAlternateLinks(path)}`,
    `    <lastmod>${lastmod}</lastmod>`,
    "  </url>",
  ].join("\n");
};

export function GET(): Response {
  const urlEntries = sitemapEntries.map(buildUrlNode).join("\n");

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
