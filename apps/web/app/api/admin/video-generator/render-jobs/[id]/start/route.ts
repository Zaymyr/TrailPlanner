import { z } from "zod";

import {
  buildRenderUrl,
  createRenderToken,
  getGoogleAccessToken,
  getRenderInputObject,
  getRenderJob,
  getStorageObjectSize,
  runRenderJob,
  updateRenderJob,
} from "../../../../../../../lib/video-render";
import { authorizeRenderAdmin, describeRenderError, renderJson, renderJsonError } from "../../../../../../../lib/video-render-api";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(request: Request, context: { params: { id?: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return renderJsonError("Invalid render job id.", 400);
  const gate = await authorizeRenderAdmin(request);
  if (!gate.ok) return gate.response;
  const { supabase, config } = gate.value;
  const jobId = params.data.id;

  try {
    const job = await getRenderJob(supabase, jobId);
    if (!job) return renderJsonError("Rendu introuvable.", 404);
    if (job.status !== "uploading") return renderJsonError("Ce rendu a déjà été lancé.", 409);

    const accessToken = await getGoogleAccessToken(config, request);
    if ((await getStorageObjectSize(config, accessToken, getRenderInputObject(jobId))) === null) {
      return renderJsonError("La composition n’a pas été reçue : relance le rendu.", 409);
    }
    const execution = await runRenderJob(config, accessToken, buildRenderUrl(new URL(request.url).origin, job, createRenderToken(config.tokenSecret, jobId)));
    const updated = await updateRenderJob(supabase, jobId, { status: "queued", cloud_run_execution: execution }, ["uploading"]);
    return renderJson({ job: { id: jobId, status: updated?.status ?? "queued" } });
  } catch (error) {
    const message = describeRenderError(error, "Le rendu n’a pas pu démarrer.");
    await updateRenderJob(supabase, jobId, { status: "failed", message, finished_at: new Date().toISOString() }, ["uploading"]).catch(() => null);
    return renderJsonError(message, 502);
  }
}
