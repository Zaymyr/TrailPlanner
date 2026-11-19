import {
  getInstagramCredentials,
  getInstagramGraphVersion,
  INSTAGRAM_TOKEN_ERROR_MESSAGE,
  isInstagramPublishDryRun,
} from "../../../../lib/instagram/config";
import { createInstagramGraphClient, InstagramGraphError, type AccountProfile, type PublishingLimit } from "../../../../lib/instagram/graph";
import { authorizeVideoAdmin, renderJson } from "../../../../lib/video-render-api";

const describeGraphError = (error: unknown) => {
  if (error instanceof InstagramGraphError) {
    return error.kind === "auth" ? `${INSTAGRAM_TOKEN_ERROR_MESSAGE} (${error.message}).` : error.message;
  }
  return "Instagram injoignable.";
};

/**
 * Read-only status card: whether the System User credentials are configured, the account profile
 * and publishing quota (read from Meta only when credentials exist), and the publishing mode.
 * The token is never returned.
 */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;

  const credentials = getInstagramCredentials();
  let profile: AccountProfile | null = null;
  let quota: PublishingLimit | null = null;
  let profileError: string | null = null;

  if (credentials) {
    const client = createInstagramGraphClient();
    const [profileResult, quotaResult] = await Promise.allSettled([
      client.getAccountProfile(credentials.igUserId, credentials.accessToken),
      client.getPublishingLimit(credentials.igUserId, credentials.accessToken),
    ]);
    if (profileResult.status === "fulfilled") profile = profileResult.value;
    else profileError = describeGraphError(profileResult.reason);
    if (quotaResult.status === "fulfilled") quota = quotaResult.value;
  }

  return renderJson({
    credentialsConfigured: credentials !== null,
    igUserId: credentials?.igUserId ?? null,
    pageId: credentials?.pageId ?? (process.env.FB_PAGE_ID?.trim() || null),
    graphVersion: getInstagramGraphVersion(),
    profile,
    profileError,
    quota,
    dryRun: isInstagramPublishDryRun(),
  });
}
