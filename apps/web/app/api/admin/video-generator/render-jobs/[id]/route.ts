import { z } from "zod";

import {
  deleteRenderJob,
  deleteStorageObject,
  getGoogleAccessToken,
  getRenderInputObject,
  getRenderJob,
  getRenderOutputObject,
} from "../../../../../../lib/video-render";
import { authorizeRenderAdmin, describeRenderError, renderJson, renderJsonError } from "../../../../../../lib/video-render-api";

const paramsSchema = z.object({ id: z.string().uuid() });

/**
 * Deletes a finished or failed render: its row (so the list and the per-race video counts drop
 * it) and, when the bucket allows it, its MP4 and composition. A render still in progress is kept.
 */
export async function DELETE(request: Request, context: { params: { id?: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return renderJsonError("Invalid render job id.", 400);
  const gate = await authorizeRenderAdmin(request);
  if (!gate.ok) return gate.response;
  const { supabase, config } = gate.value;
  const jobId = params.data.id;

  try {
    const job = await getRenderJob(supabase, jobId);
    if (!job) return renderJsonError("Rendu introuvable.", 404);
    if (job.status !== "done" && job.status !== "failed") {
      return renderJsonError("Ce rendu est en cours : attends sa fin pour le supprimer.", 409);
    }

    const accessToken = await getGoogleAccessToken(config, request);
    const removed = await Promise.all(
      [getRenderOutputObject(jobId), getRenderInputObject(jobId)].map((objectName) =>
        deleteStorageObject(config, accessToken, objectName).catch(() => false),
      ),
    );
    if (!(await deleteRenderJob(supabase, jobId))) return renderJsonError("Ce rendu ne peut plus être supprimé.", 409);
    return renderJson({ deleted: true, filesDeleted: removed.every(Boolean) });
  } catch (error) {
    return renderJsonError(describeRenderError(error, "Le rendu n’a pas pu être supprimé."), 502);
  }
}
