import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { legacyPaths, legacyRedirectMap } from "./lib/legacy-redirects";

export const config = {
  matcher: legacyPaths.map((path) => `${path}/:path*`),
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const normalizedPath =
    pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  const redirectTo = legacyRedirectMap[normalizedPath as keyof typeof legacyRedirectMap];

  if (!redirectTo) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = redirectTo;

  return NextResponse.redirect(redirectUrl, 301);
}
