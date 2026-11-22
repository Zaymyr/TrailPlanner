import { z } from "zod";

import { toFlyoverAdminView } from "../../../../lib/flyover-admin";
import { buildFlyoverOrderUrl, createFlyoverOrderRepository } from "../../../../lib/flyover-orders";
import {
  getGoogleAccessToken,
  getReelFileName,
  getRenderOutputObject,
  getVideoRenderConfig,
  signStorageUrl,
  VIDEO_RENDER_JOB_COLUMNS,
  videoRenderJobRowSchema,
} from "../../../../lib/video-render";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../lib/video-render-api";

export const dynamic = "force-dynamic";

/**
 * Admin › Publications › Survols: the latest organizer flyover orders with their render state, a
 * link to the customer's order page and, for a finished render, a 1-hour download link.
 */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const { supabase } = gate.value;
  try {
    const orders = await createFlyoverOrderRepository(supabase).listRecent(50);
    const jobIds = orders.map((order) => order.render_job_id).filter((id): id is string => Boolean(id));
    const jobs = new Map<string, z.infer<typeof videoRenderJobRowSchema>>();
    if (jobIds.length) {
      const response = await fetch(`${supabase.supabaseUrl}/rest/v1/video_render_jobs?id=in.(${jobIds.join(",")})&select=${VIDEO_RENDER_JOB_COLUMNS}`, {
        headers: { apikey: supabase.supabaseServiceRoleKey, Authorization: `Bearer ${supabase.supabaseServiceRoleKey}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Unable to read render jobs (${response.status}).`);
      for (const job of z.array(videoRenderJobRowSchema).parse(await response.json())) jobs.set(job.id, job);
    }

    // Download links need Google credentials; without them the list still loads.
    const config = getVideoRenderConfig();
    const accessToken = config && [...jobs.values()].some((job) => job.status === "done")
      ? await getGoogleAccessToken(config, request).catch(() => null)
      : null;

    const views = await Promise.all(orders.map(async (order) => {
      const job = order.render_job_id ? jobs.get(order.render_job_id) ?? null : null;
      const downloadUrl = config && accessToken && job?.status === "done"
        ? await signStorageUrl({
          config,
          accessToken,
          method: "GET",
          objectName: getRenderOutputObject(job.id),
          expiresSeconds: 60 * 60,
          responseDisposition: `attachment; filename="${getReelFileName(order.race_name)}"`,
        }).catch(() => null)
        : null;
      let orderUrl: string | null = null;
      try {
        orderUrl = buildFlyoverOrderUrl(order.id);
      } catch {
        orderUrl = null;
      }
      return toFlyoverAdminView(order, { renderStatus: job?.status ?? null, renderProgress: job?.progress ?? null, orderUrl, downloadUrl });
    }));
    return renderJson({ orders: views });
  } catch (error) {
    console.error("Flyover orders admin list failed", error instanceof Error ? error.message : error);
    return renderJsonError("Les commandes de survol n’ont pas pu être chargées.", 502);
  }
}
