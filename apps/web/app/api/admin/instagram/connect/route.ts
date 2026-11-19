import { getInstagramAppConfig, INSTAGRAM_OAUTH_COOKIE } from "../../../../../lib/instagram/config";
import { createOAuthState, getSocialTokenKey, OAUTH_STATE_TTL_SECONDS } from "../../../../../lib/instagram/crypto";
import { buildInstagramAuthorizeUrl } from "../../../../../lib/instagram/graph";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../../lib/video-render-api";

/**
 * Starts "Connecter Instagram": returns the Instagram authorize URL with a signed state bound to
 * this admin, and keeps the state nonce in an httpOnly cookie checked by the callback.
 */
export async function POST(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const app = getInstagramAppConfig();
  if (!app) return renderJsonError("Application Meta non configurée (INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI).", 503);
  const key = getSocialTokenKey();
  if (!key) return renderJsonError("SOCIAL_TOKEN_ENCRYPTION_KEY absente ou invalide.", 503);

  const { nonce, state } = createOAuthState(key, gate.value.userId);
  const response = renderJson({ url: buildInstagramAuthorizeUrl(app, state) });
  response.cookies.set({
    name: INSTAGRAM_OAUTH_COOKIE,
    value: nonce,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/admin/instagram",
    maxAge: OAUTH_STATE_TTL_SECONDS,
  });
  return response;
}
