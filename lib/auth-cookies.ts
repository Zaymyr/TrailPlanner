import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

export const ACCESS_TOKEN_COOKIE = "trailplanner.access-token";
export const REFRESH_TOKEN_COOKIE = "trailplanner.refresh-token";

type CookieDeleter = Pick<ResponseCookies, "delete">;

export const clearAuthCookies = (cookieJar: CookieDeleter) => {
  cookieJar.delete({ name: ACCESS_TOKEN_COOKIE, path: "/" });
  cookieJar.delete({ name: REFRESH_TOKEN_COOKIE, path: "/" });
};
