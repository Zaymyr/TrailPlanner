import { z } from "zod";

import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../../../lib/video-render-api";
import { readNarration, saveNarration, saveNarrationRequestSchema } from "../../../../../../lib/video-narrations";

const paramsSchema = z.object({ raceId: z.string().uuid() });

export async function GET(request: Request, context: { params: { raceId: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return renderJsonError("Course invalide.", 400);
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;

  try {
    return renderJson({ narration: await readNarration(gate.value.supabase, params.data.raceId) });
  } catch (error) {
    console.error("Video narration read failed", error instanceof Error ? error.message : error);
    return renderJsonError("Le récit enregistré n’a pas pu être lu.", 502);
  }
}

export async function PUT(request: Request, context: { params: { raceId: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return renderJsonError("Course invalide.", 400);
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;

  const parsed = saveNarrationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return renderJsonError(`Récit invalide (${issue?.path.join(".") || "corps"} : ${issue?.message ?? "format"}).`, 400);
  }

  try {
    return renderJson(await saveNarration(gate.value.supabase, params.data.raceId, gate.value.userId, parsed.data));
  } catch (error) {
    console.error("Video narration save failed", error instanceof Error ? error.message : error);
    return renderJsonError("Le récit n’a pas pu être enregistré.", 502);
  }
}
