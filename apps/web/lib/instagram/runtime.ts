import { createSocialPostRepository, META_VIDEO_URL_TTL_SECONDS } from "../social-posts";
import type { SupabaseServiceConfig } from "../supabase";
import {
  getGoogleAccessToken,
  getRenderJob,
  getVideoRenderConfig,
  signStorageUrl,
  VideoRenderSetupError,
} from "../video-render";
import { getInstagramAccount, markAccountNeedsReconnect } from "./accounts";
import { isInstagramPublishDryRun } from "./config";
import { decryptSocialToken, getSocialTokenKey } from "./crypto";
import { createDryRunGraphClient, createInstagramGraphClient } from "./graph";
import type { PublisherDeps } from "./publisher";

/**
 * Production wiring of the publishing state machine: Supabase rows, the encrypted account token,
 * the real or simulated Graph client, and Cloud Storage signing (read-only use of video-render).
 * `request` carries the Vercel OIDC token used to reach Google.
 */
export const createPublisherDeps = (supabase: SupabaseServiceConfig, request: Request): PublisherDeps & { dryRun: boolean } => ({
  dryRun: isInstagramPublishDryRun(),
  posts: createSocialPostRepository(supabase),
  now: () => new Date(),
  graphFor: (dryRun) => (dryRun ? createDryRunGraphClient() : createInstagramGraphClient()),
  getAccount: async () => {
    const key = getSocialTokenKey();
    if (!key) return { error: "SOCIAL_TOKEN_ENCRYPTION_KEY absente : publication réelle impossible." };
    const account = await getInstagramAccount(supabase);
    if (!account) return { error: "Aucun compte Instagram connecté." };
    if (account.status !== "connected") return { error: account.status_message ?? "Compte Instagram à reconnecter." };
    if (Date.parse(account.token_expires_at) <= Date.now()) {
      await markAccountNeedsReconnect(supabase, account.id, "Le jeton Instagram a expiré : reconnecte le compte.");
      return { error: "Le jeton Instagram a expiré : reconnecte le compte." };
    }
    try {
      return { id: account.id, igUserId: account.ig_user_id, accessToken: decryptSocialToken(key, account.access_token_encrypted) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Jeton Instagram illisible." };
    }
  },
  markNeedsReconnect: (accountId, message) => markAccountNeedsReconnect(supabase, accountId, `Jeton refusé par Instagram : ${message}`),
  getVideoJob: async (jobId) => {
    const job = await getRenderJob(supabase, jobId);
    return job ? { status: job.status, finished_at: job.finished_at } : null;
  },
  signVideoUrl: async (objectPath) => {
    const config = getVideoRenderConfig();
    if (!config) throw new VideoRenderSetupError("Stockage vidéo non configuré (variables Google Cloud absentes).");
    return signStorageUrl({
      config,
      accessToken: await getGoogleAccessToken(config, request),
      method: "GET",
      objectName: objectPath,
      expiresSeconds: META_VIDEO_URL_TTL_SECONDS,
    });
  },
});
