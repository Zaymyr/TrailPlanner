import { NextRequest, NextResponse } from "next/server";

import { resolveDemoRedirect } from "../../lib/demo-app-link";
import { withSecurityHeaders } from "../../lib/http";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const location = resolveDemoRedirect(request.headers.get("user-agent") ?? "", request.nextUrl.origin);
  // Built by hand: `intent://` targets must reach the browser exactly as written.
  const response = new NextResponse(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store", Vary: "User-Agent", "X-Robots-Tag": "noindex" },
  });
  return withSecurityHeaders(response);
}
