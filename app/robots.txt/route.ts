import { SITE_URL } from "../seo";

export function GET(): Response {
  const body = [`User-agent: *`, `Allow: /`, `Sitemap: ${new URL("/sitemap.xml", SITE_URL).toString()}`].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
