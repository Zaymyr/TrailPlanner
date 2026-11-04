import { z } from "zod";

import {
  getGoogleAccessToken,
  getRenderInputObject,
  getRenderOutputObject,
  getStorageObjectSize,
  signStorageUrl,
  updateRenderJob,
} from "../../../../../lib/video-render";
import { authorizeRenderPage, describeRenderError, renderJson, renderJsonError } from "../../../../../lib/video-render-api";

const paramsSchema = z.object({ id: z.string().uuid() });

const reportSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("running"), progress: z.number().min(0).max(1) }),
  z.object({ status: z.literal("failed"), message: z.string().trim().min(1).max(500) }),
  z.object({ status: z.literal("done") }),
]);

/**
 * Called by the render page with its job token. GET marks the job running and returns a short
 * signed URL of the saved composition plus a signed upload URL for the MP4.
 */
export async function GET(request: Request, context: { params: { id?: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return renderJsonError("Invalid render job id.", 400);
  const gate = await authorizeRenderPage(request, params.data.id);
  if (!gate.ok) return gate.response;
  const { supabase, config, job } = gate.value;
  if (job.status !== "queued" && job.status !== "running") return renderJsonError("Ce rendu n’est plus en attente.", 409);

  try {
    const accessToken = await getGoogleAccessToken(config, request);
    const [inputUrl, outputUploadUrl] = await Promise.all([
      signStorageUrl({ config, accessToken, method: "GET", objectName: getRenderInputObject(job.id), expiresSeconds: 30 * 60 }),
      // The slowest software render of a 2-minute reel stays well under three hours.
      signStorageUrl({ config, accessToken, method: "PUT", objectName: getRenderOutputObject(job.id), expiresSeconds: 3 * 60 * 60 }),
    ]);
    await updateRenderJob(supabase, job.id, { status: "running", progress: 0, started_at: new Date().toISOString() }, ["queued"]);
    return renderJson({ job: { id: job.id, width: job.width, height: job.height }, inputUrl, outputUploadUrl });
  } catch (error) {
    return renderJsonError(describeRenderError(error, "Impossible de préparer le rendu."), 502);
  }
}

/** Progress, failure, or completion (checked against the uploaded file). */
export async function POST(request: Request, context: { params: { id?: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return renderJsonError("Invalid render job id.", 400);
  const gate = await authorizeRenderPage(request, params.data.id);
  if (!gate.ok) return gate.response;
  const { supabase, config, job } = gate.value;

  const report = reportSchema.safeParse(await request.json().catch(() => null));
  if (!report.success) return renderJsonError("Rapport de rendu invalide.", 400);
  const active = ["queued", "running"] as const;

  try {
    if (report.data.status === "running") {
      await updateRenderJob(supabase, job.id, { status: "running", progress: report.data.progress }, active);
    } else if (report.data.status === "failed") {
      await updateRenderJob(supabase, job.id, { status: "failed", message: report.data.message, finished_at: new Date().toISOString() }, active);
    } else {
      const size = await getStorageObjectSize(config, await getGoogleAccessToken(config, request), getRenderOutputObject(job.id));
      if (!size) return renderJsonError("La vidéo n’a pas été reçue.", 409);
      await updateRenderJob(supabase, job.id, {
        status: "done",
        progress: 1,
        output_size_bytes: size,
        message: null,
        finished_at: new Date().toISOString(),
      }, active);
    }
    return renderJson({ ok: true });
  } catch (error) {
    return renderJsonError(describeRenderError(error, "Impossible d’enregistrer l’avancement du rendu."), 502);
  }
}
