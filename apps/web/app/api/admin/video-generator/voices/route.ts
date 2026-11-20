import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../../lib/video-render-api";
import { addVoiceRequestSchema, checkElevenLabsVoice, insertPoolVoice, listPoolVoices } from "../../../../../lib/video-voices";

/** The admin's shared pool of ElevenLabs voices (random pick for each new reel). */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    return renderJson({ voices: await listPoolVoices(gate.value.supabase) });
  } catch (error) {
    console.error("Video voices list failed", error instanceof Error ? error.message : error);
    return renderJsonError("Les voix n’ont pas pu être lues.", 502);
  }
}

export async function POST(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const parsed = addVoiceRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return renderJsonError(`Voix invalide (${issue?.path.join(".") || "corps"} : ${issue?.message ?? "format"}).`, 400);
  }

  // The check only suggests a name and warns: it never blocks the add.
  const check = await checkElevenLabsVoice(parsed.data.voiceId);
  const name = parsed.data.name ?? check.name;
  if (!name) return renderJsonError("Donne un nom à cette voix.", 400);

  try {
    const result = await insertPoolVoice(gate.value.supabase, {
      elevenlabs_voice_id: parsed.data.voiceId,
      name,
      created_by: gate.value.userId,
    });
    if ("duplicate" in result) return renderJsonError("Cette voix est déjà dans le pool.", 409);
    return renderJson({ voice: result.voice, warning: check.warning }, 201);
  } catch (error) {
    console.error("Video voice add failed", error instanceof Error ? error.message : error);
    return renderJsonError("La voix n’a pas pu être ajoutée.", 502);
  }
}
