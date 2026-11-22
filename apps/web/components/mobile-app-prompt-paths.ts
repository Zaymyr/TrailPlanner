/**
 * Paths where the mobile app prompt must never show: internal screens, and
 * pages that already offer the store buttons themselves (one overlay at a time).
 */
export const MOBILE_APP_PROMPT_HIDDEN_PATH_PREFIXES = [
  "/admin",
  "/onboarding",
  "/links",
  "/en/links",
  "/courses",
  "/race-planner",
  "/livret-coureur",
  "/livret-supporter",
  "/carte-visite",
  "/demo",
] as const;

export const isMobileAppPromptHiddenPath = (pathname: string): boolean =>
  MOBILE_APP_PROMPT_HIDDEN_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
