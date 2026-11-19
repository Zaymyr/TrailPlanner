/**
 * Instagram API with Instagram Login (graph.instagram.com, no Facebook Page). Only the Meta app
 * credentials, the redirect URI, the token encryption key and the dry-run switch live in env vars;
 * the account token itself is stored encrypted in social_accounts.
 */

/** Graph version used by the publishing endpoints (Meta docs show v27.0 on graph.instagram.com). */
export const DEFAULT_INSTAGRAM_GRAPH_VERSION = "v27.0";

export const INSTAGRAM_GRAPH_HOST = "https://graph.instagram.com";
export const INSTAGRAM_OAUTH_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
export const INSTAGRAM_OAUTH_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
export const INSTAGRAM_SCOPES = ["instagram_business_basic", "instagram_business_content_publish"] as const;

/** httpOnly cookie holding the OAuth state nonce between "Connecter" and the callback. */
export const INSTAGRAM_OAUTH_COOKIE = "pace-yourself.instagram-oauth";

export type InstagramAppConfig = {
  appId: string;
  appSecret: string;
  redirectUri: string;
};

export const getInstagramAppConfig = (): InstagramAppConfig | null => {
  const appId = process.env.INSTAGRAM_APP_ID?.trim() ?? "";
  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim() ?? "";
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI?.trim() ?? "";
  if (!appId || !appSecret || !/^https:\/\//.test(redirectUri)) return null;
  return { appId, appSecret, redirectUri };
};

/**
 * "v27.0" by default; INSTAGRAM_GRAPH_API_VERSION overrides it, and "none" drops the prefix
 * (graph.instagram.com also answers unversioned paths, on its default version).
 */
export const getInstagramGraphVersion = () => {
  const raw = process.env.INSTAGRAM_GRAPH_API_VERSION?.trim();
  if (!raw) return DEFAULT_INSTAGRAM_GRAPH_VERSION;
  if (raw.toLowerCase() === "none") return null;
  return /^v\d+\.\d+$/.test(raw) ? raw : DEFAULT_INSTAGRAM_GRAPH_VERSION;
};

/**
 * Simulation unless INSTAGRAM_PUBLISH_DRY_RUN is exactly "false" and the Meta app is configured:
 * a missing or mistyped variable never publishes for real.
 */
export const isInstagramPublishDryRun = () =>
  process.env.INSTAGRAM_PUBLISH_DRY_RUN?.trim() !== "false" || getInstagramAppConfig() === null;
