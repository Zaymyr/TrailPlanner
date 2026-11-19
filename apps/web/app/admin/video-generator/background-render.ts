import type { ReelContent } from "../../../lib/reel-content";
import type { VideoRenderSnapshot } from "./render-snapshot";
import { VIDEO_RESOLUTIONS } from "./video-composition";

export const readRenderMessage = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  return payload?.message ?? fallback;
};

/**
 * Launches a background render on Google Cloud: creates the job, uploads the composition straight
 * to Cloud Storage (it can weigh several megabytes, more than a serverless request body allows),
 * then starts it. Shared by the "Générer en arrière-plan" button and the one-click reel.
 * `autoDraft` asks the server to create the Instagram draft when the render finishes.
 */
export const launchBackgroundRender = async ({ accessToken, raceId, raceTitle, snapshot, content, autoDraft = false, fetcher = fetch }: {
  accessToken: string;
  raceId: string;
  raceTitle: string;
  snapshot: VideoRenderSnapshot;
  /** Reel text of a highlights video, stored with the render job (null for full reels). */
  content?: ReelContent | null;
  autoDraft?: boolean;
  fetcher?: typeof fetch;
}): Promise<{ jobId: string }> => {
  const base = VIDEO_RESOLUTIONS[snapshot.settings.resolution];
  const size = snapshot.settings.viewport === "portrait" ? base : { width: base.height, height: base.width };
  const created = await fetcher("/api/admin/video-generator/render-jobs", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raceId, raceTitle, ...size, ...(content ? { content } : {}), ...(autoDraft ? { autoDraft: true } : {}) }),
  });
  if (!created.ok) throw new Error(await readRenderMessage(created, "Le rendu n’a pas pu être créé."));
  const { job, inputUploadUrl } = (await created.json()) as { job: { id: string }; inputUploadUrl: string };

  const uploaded = await fetcher(inputUploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
  });
  if (!uploaded.ok) throw new Error(`L’envoi de la composition a échoué (${uploaded.status}).`);

  const started = await fetcher(`/api/admin/video-generator/render-jobs/${job.id}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!started.ok) throw new Error(await readRenderMessage(started, "Le rendu n’a pas pu démarrer."));
  return { jobId: job.id };
};
