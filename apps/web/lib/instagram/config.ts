/**
 * Instagram API with Facebook Login (graph.facebook.com), through the Facebook Page linked to the
 * professional account. Authentication is a System User token with no expiration, kept in the
 * server-only env var IG_SYSTEM_USER_TOKEN: there is no OAuth flow and no refresh.
 * The token never appears in logs, responses or errors.
 */

/** Graph version of every call (Meta's Instagram examples use v27.0). */
export const DEFAULT_INSTAGRAM_GRAPH_VERSION = "v27.0";

export const FACEBOOK_GRAPH_HOST = "https://graph.facebook.com";

export type InstagramCredentials = {
  accessToken: string;
  igUserId: string;
  /** Informational only (shown in the admin); publishing does not need it. */
  pageId: string | null;
};

/** Present when both IG_SYSTEM_USER_TOKEN and IG_USER_ID are set. */
export const getInstagramCredentials = (): InstagramCredentials | null => {
  const accessToken = process.env.IG_SYSTEM_USER_TOKEN?.trim() ?? "";
  const igUserId = process.env.IG_USER_ID?.trim() ?? "";
  if (!accessToken || !/^\d{1,32}$/.test(igUserId)) return null;
  return { accessToken, igUserId, pageId: process.env.FB_PAGE_ID?.trim() || null };
};

/** "v27.0" by default; INSTAGRAM_GRAPH_API_VERSION overrides it when it looks like a version. */
export const getInstagramGraphVersion = () => {
  const raw = process.env.INSTAGRAM_GRAPH_API_VERSION?.trim();
  return raw && /^v\d+\.\d+$/.test(raw) ? raw : DEFAULT_INSTAGRAM_GRAPH_VERSION;
};

/**
 * Simulation unless INSTAGRAM_PUBLISH_DRY_RUN is exactly "false" and the credentials are present:
 * a missing or mistyped variable never publishes for real.
 */
export const isInstagramPublishDryRun = () =>
  process.env.INSTAGRAM_PUBLISH_DRY_RUN?.trim() !== "false" || getInstagramCredentials() === null;

/** Shown on a post when Meta rejects the token or its permissions (OAuth codes 190, 10, 200-299). */
export const INSTAGRAM_TOKEN_ERROR_MESSAGE = "Jeton Instagram invalide ou droits insuffisants — vérifier IG_SYSTEM_USER_TOKEN";
