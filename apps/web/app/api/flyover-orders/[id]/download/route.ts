import { NextResponse } from "next/server";

import { createFlyoverOrderRepository, verifyFlyoverOrderToken } from "../../../../../lib/flyover-orders";
import { withSecurityHeaders } from "../../../../../lib/http";
import { getSupabaseServiceConfig } from "../../../../../lib/supabase";
import {
  getGoogleAccessToken,
  getReelFileName,
  getRenderJob,
  getRenderOutputObject,
  getVideoRenderConfig,
  signStorageUrl,
} from "../../../../../lib/video-render";

export const dynamic = "force-dynamic";

const fail = (message: string, status: number) => withSecurityHeaders(NextResponse.json({ message }, { status }));

/**
 * Download of a finished flyover video (offer "download" only), from the link of the order page:
 * the order token is checked, then the request is redirected to a 10-minute signed URL of the MP4.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const token = new URL(request.url).searchParams.get("t");
  if (!/^[0-9a-f-]{36}$/i.test(params.id) || !verifyFlyoverOrderToken(params.id, token)) return fail("Lien invalide.", 404);
  const supabase = getSupabaseServiceConfig();
  const config = getVideoRenderConfig();
  if (!supabase || !config) return fail("Téléchargement indisponible pour le moment.", 503);

  const order = await createFlyoverOrderRepository(supabase).get(params.id).catch(() => null);
  if (!order || order.offer !== "download" || order.status !== "ready" || !order.render_job_id) return fail("Vidéo indisponible.", 404);
  const job = await getRenderJob(supabase, order.render_job_id).catch(() => null);
  if (!job || job.status !== "done") return fail("Vidéo indisponible.", 404);

  try {
    const accessToken = await getGoogleAccessToken(config, request);
    const url = await signStorageUrl({
      config,
      accessToken,
      method: "GET",
      objectName: getRenderOutputObject(job.id),
      expiresSeconds: 10 * 60,
      responseDisposition: `attachment; filename="${getReelFileName(order.race_name)}"`,
    });
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error("Flyover download failed", error instanceof Error ? error.message : error);
    return fail("Téléchargement indisponible pour le moment.", 502);
  }
}
