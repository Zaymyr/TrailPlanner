import { createSocialPostRepository, META_VIDEO_URL_TTL_SECONDS } from "../social-posts";
import type { SupabaseServiceConfig } from "../supabase";
import {
  getGoogleAccessToken,
  getRenderJob,
  getVideoRenderConfig,
  signStorageUrl,
  VideoRenderSetupError,
} from "../video-render";
import { getInstagramCredentials, isInstagramPublishDryRun } from "./config";
import { createDryRunGraphClient, createInstagramGraphClient } from "./graph";
import type { PublisherDeps } from "./publisher";

/**
 * Production wiring of the publishing state machine: Supabase rows, the System User credentials
 * from the environment, the real or simulated Graph client, and Cloud Storage signing (read-only
 * use of video-render). `request` carries the Vercel OIDC token used to reach Google.
 */
export const createPublisherDeps = (supabase: SupabaseServiceConfig, request: Request): PublisherDeps & { dryRun: boolean } => ({
  dryRun: isInstagramPublishDryRun(),
  posts: createSocialPostRepository(supabase),
  now: () => new Date(),
  graphFor: (dryRun) => (dryRun ? createDryRunGraphClient() : createInstagramGraphClient()),
  getAccount: async () => {
    const credentials = getInstagramCredentials();
    if (!credentials) return { error: "IG_SYSTEM_USER_TOKEN ou IG_USER_ID absent : publication réelle impossible." };
    return { igUserId: credentials.igUserId, accessToken: credentials.accessToken };
  },
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
