import type { MetadataRoute } from "next";

import { SITE_URL } from "./seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Catalog filter combinations are already `noindex` (see courses/page.tsx)
      // and each one is a server render. Pagination (`?page=`) stays crawlable.
      disallow: [
        "/api/",
        "/courses?q=",
        "/courses?*&q=",
        "/courses?distance=",
        "/courses?*&distance=",
        "/courses?period=",
        "/courses?*&period=",
      ],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  };
}

/**
 * Manual verification checklist:
 * - Open https://<domain>/sitemap.xml -> must show XML (<urlset>).
 * - curl -I https://<domain>/sitemap.xml -> HTTP 200 and Content-Type is xml.
 * - Open https://<domain>/robots.txt -> includes Sitemap line.
 * - Search Console -> submit sitemap.xml.
 */
