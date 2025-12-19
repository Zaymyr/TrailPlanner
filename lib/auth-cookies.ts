export const ACCESS_TOKEN_COOKIE = "trailplanner.access-token";
export const REFRESH_TOKEN_COOKIE = "trailplanner.refresh-token";

export const clearAuthCookies = (cookieJar: {
  delete: (name: string, options?: { path?: string }) => void;
}) => {
  cookieJar.delete(ACCESS_TOKEN_COOKIE, { path: "/" });
  cookieJar.delete(REFRESH_TOKEN_COOKIE, { path: "/" });
};
