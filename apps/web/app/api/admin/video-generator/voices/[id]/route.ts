import { z } from "zod";

import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../../../lib/video-render-api";
import { deletePoolVoice, updatePoolVoice, updateVoiceRequestSchema } from "../../../../../../lib/video-voices";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function PATCH(request: Request, context: { params: { id?: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return renderJsonError("Voix invalide.", 400);
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const parsed = updateVoiceRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return renderJsonError(`Voix invalide (${issue?.path.join(".") || "corps"} : ${issue?.message ?? "format"}).`, 400);
  }

  try {
    const voice = await updatePoolVoice(gate.value.supabase, params.data.id, parsed.data);
    if (!voice) return renderJsonError("Voix introuvable.", 404);
    return renderJson({ voice });
  } catch (error) {
    console.error("Video voice update failed", error instanceof Error ? error.message : error);
    return renderJsonError("La voix n’a pas pu être modifiée.", 502);
  }
}

export async function DELETE(request: Request, context: { params: { id?: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return renderJsonError("Voix invalide.", 400);
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;

  try {
    if (!(await deletePoolVoice(gate.value.supabase, params.data.id))) return renderJsonError("Voix introuvable.", 404);
    return renderJson({ deleted: true });
  } catch (error) {
    console.error("Video voice delete failed", error instanceof Error ? error.message : error);
    return renderJsonError("La voix n’a pas pu être supprimée.", 502);
  }
}
