import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { blogRedirectMap } from "./lib/blog/redirects";
import { legacyRedirectMap } from "./lib/legacy-redirects";

export const config = {
  matcher: ["/((?!_next|api|sitemap.xml|robots.txt|favicon.ico|.*\\..*).*)"],
};

const redirectMap: Record<string, string> = {
  ...legacyRedirectMap,
  ...blogRedirectMap,
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const normalizedPath =
    pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  const redirectTo = redirectMap[normalizedPath];

  if (!redirectTo) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = redirectTo;

  return NextResponse.redirect(redirectUrl, 301);
}
