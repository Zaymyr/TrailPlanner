import { isCarouselRenderStale, updateCarouselRenderJob } from "../../../../lib/carousels/carousel-render";
import {
  listCarouselRenderActivityRows,
  RENDER_LOST_MESSAGE,
  listReelRenderActivityRows,
  selectRenderActivity,
  toCarouselRenderActivity,
  toReelRenderActivity,
} from "../../../../lib/render-activity";
import { isRenderJobStale, updateRenderJob } from "../../../../lib/video-render";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../lib/video-render-api";

export const dynamic = "force-dynamic";

/**
 * Recent reel and carousel renders with their stage (Publications admin, polled while one is
 * active). A render that stopped reporting is marked failed here, like the video generator does.
 */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const { supabase } = gate.value;
  try {
    const [reels, carousels] = await Promise.all([listReelRenderActivityRows(supabase), listCarouselRenderActivityRows(supabase)]);
    const now = Date.now();
    const finishedAt = new Date(now).toISOString();
    const reelRows = await Promise.all(reels.map(async (row) => {
      if (!isRenderJobStale(row, now)) return row;
      const updated = await updateRenderJob(supabase, row.id, { status: "failed", message: RENDER_LOST_MESSAGE, finished_at: finishedAt }, ["uploading", "queued", "running"]);
      return updated ? { ...row, status: "failed" as const, message: RENDER_LOST_MESSAGE, finished_at: finishedAt } : row;
    }));
    const carouselRows = await Promise.all(carousels.map(async (row) => {
      if (!isCarouselRenderStale(row, now)) return row;
      const updated = await updateCarouselRenderJob(supabase, row.id, { status: "failed", message: RENDER_LOST_MESSAGE, finished_at: finishedAt }, ["queued", "running"]);
      return updated ? { ...row, status: "failed" as const, message: RENDER_LOST_MESSAGE, finished_at: finishedAt } : row;
    }));
    return renderJson({
      jobs: selectRenderActivity([...reelRows.map(toReelRenderActivity), ...carouselRows.map(toCarouselRenderActivity)], now),
    });
  } catch (error) {
    console.error("Render activity read failed", error instanceof Error ? error.message : error);
    return renderJsonError("Les rendus en cours n’ont pas pu être lus.", 502);
  }
}
