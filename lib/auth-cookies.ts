export const ACCESS_TOKEN_COOKIE = "trailplanner.access-token";
export const REFRESH_TOKEN_COOKIE = "trailplanner.refresh-token";

type CookieDeleter = {
  delete: (name: string | { name: string; path?: string }) => unknown;
};

export const clearAuthCookies = (cookieJar: CookieDeleter) => {
  cookieJar.delete({ name: ACCESS_TOKEN_COOKIE, path: "/" });
  cookieJar.delete({ name: REFRESH_TOKEN_COOKIE, path: "/" });
};
