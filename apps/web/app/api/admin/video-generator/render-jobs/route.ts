import { z } from "zod";

import {
  getGoogleAccessToken,
  getReelFileName,
  getRenderInputObject,
  getRenderOutputObject,
  insertRenderJob,
  isRenderJobStale,
  listRenderJobs,
  signStorageUrl,
  updateRenderJob,
} from "../../../../../lib/video-render";
import { authorizeRenderAdmin, describeRenderError, renderJson, renderJsonError } from "../../../../../lib/video-render-api";

const createSchema = z.object({
  raceId: z.string().uuid(),
  raceTitle: z.string().trim().min(1).max(200),
  width: z.number().int().min(160).max(4096),
  height: z.number().int().min(160).max(4096),
});

export async function GET(request: Request) {
  const gate = await authorizeRenderAdmin(request);
  if (!gate.ok) return gate.response;
  const { supabase, config } = gate.value;

  try {
    const rows = await listRenderJobs(supabase, 8);
    const now = Date.now();
    const jobs = await Promise.all(rows.map(async (row) => {
      let current = row;
      if (isRenderJobStale(row, now)) {
        current = await updateRenderJob(supabase, row.id, {
          status: "failed",
          message: "Le rendu n’a plus donné de nouvelles : relance-le.",
          finished_at: new Date().toISOString(),
        }, ["uploading", "queued", "running"]) ?? row;
      }
      const downloadUrl = current.status === "done"
        ? await signStorageUrl({
          config,
          accessToken: await getGoogleAccessToken(config, request),
          method: "GET",
          objectName: getRenderOutputObject(current.id),
          expiresSeconds: 60 * 60,
          responseDisposition: `attachment; filename="${getReelFileName(current.race_title)}"`,
        })
        : null;
      return {
        id: current.id,
        raceTitle: current.race_title,
        status: current.status,
        progress: current.progress,
        message: current.message,
        width: current.width,
        height: current.height,
        sizeBytes: current.output_size_bytes,
        createdAt: current.created_at,
        startedAt: current.started_at,
        finishedAt: current.finished_at,
        downloadUrl,
      };
    }));
    return renderJson({ jobs });
  } catch (error) {
    return renderJsonError(describeRenderError(error, "Impossible de lister les rendus."), 502);
  }
}

export async function POST(request: Request) {
  const gate = await authorizeRenderAdmin(request);
  if (!gate.ok) return gate.response;
  const { userId, supabase, config } = gate.value;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return renderJsonError("Requête de rendu invalide.", 400);

  try {
    const job = await insertRenderJob(supabase, {
      race_id: parsed.data.raceId,
      race_title: parsed.data.raceTitle,
      width: parsed.data.width,
      height: parsed.data.height,
      status: "uploading",
      created_by: userId,
    });
    const inputUploadUrl = await signStorageUrl({
      config,
      accessToken: await getGoogleAccessToken(config, request),
      method: "PUT",
      objectName: getRenderInputObject(job.id),
      expiresSeconds: 15 * 60,
    });
    return renderJson({ job: { id: job.id }, inputUploadUrl }, 201);
  } catch (error) {
    return renderJsonError(describeRenderError(error, "Le rendu n’a pas pu être créé."), 502);
  }
}
