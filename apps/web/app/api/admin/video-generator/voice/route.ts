import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../lib/http";
import { mapSpokenTimingToText, toSpokenText } from "../../../../../lib/spoken-numbers";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, isAdminUser } from "../../../../../lib/supabase";
import { narrationVoiceRequestSchema } from "../../../../../lib/video-narration";

export const maxDuration = 60;

// ElevenLabs premade voice used when neither the request nor ELEVENLABS_VOICE_ID names one.
const FALLBACK_VOICE_ID = "pNInz6obpgDQGcFmaJgB";
const MODEL_IDS = { multilingual_v2: "eleven_multilingual_v2", v3: "eleven_v3" } as const;

/**
 * Expressiveness 0-1 → ElevenLabs voice settings. Lower stability and more style give a livelier,
 * more varied intonation; v3 only accepts three stability presets (creative, natural, robust).
 */
const buildVoiceSettings = (model: keyof typeof MODEL_IDS, expressiveness: number) => (model === "v3"
  ? { stability: expressiveness >= 0.66 ? 0 : expressiveness >= 0.33 ? 0.5 : 1 }
  : {
    stability: Number((0.7 - 0.5 * expressiveness).toFixed(2)),
    similarity_boost: 0.8,
    style: Number((0.1 + 0.5 * expressiveness).toFixed(2)),
    use_speaker_boost: true,
  });
// A short tail so the last syllable is not cut when the next clip starts right after.
const TAIL_MS = 150;

const speechSchema = z.object({
  audio_base64: z.string(),
  alignment: z.object({ character_end_times_seconds: z.array(z.number()) }).nullable().optional(),
});

// ElevenLabs caps parallel requests per plan (2 on the free plan, 3 on Starter).
const CONCURRENCY = 2;
const CONCURRENCY_RETRY_DELAYS_MS = [800, 1_600, 3_200];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Errors worth retrying after a short pause: the plan's parallel slots are taken (429), or a
 * library voice is still being added to the account by a parallel request (409 already_running).
 */
const isTransientElevenLabsError = (status: number, body: string) =>
  (status === 429 && body.includes("concurrent")) || (status === 409 && body.includes("already_running"));

class VoiceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Turns ElevenLabs error codes into an actionable message for the admin. */
const describeElevenLabsError = (status: number, body: string) => {
  let code = "";
  try {
    const detail = (JSON.parse(body) as { detail?: { code?: unknown; status?: unknown } }).detail;
    code = `${typeof detail?.code === "string" ? detail.code : ""} ${typeof detail?.status === "string" ? detail.status : ""}`;
  } catch {
    // Not JSON: fall back to the HTTP status.
  }
  if (code.includes("api_key_id_used_as_api_key")) {
    return "ELEVENLABS_API_KEY contient l’identifiant de la clé : colle la clé secrète elle-même (elle commence par « sk_ »).";
  }
  if (code.includes("invalid_api_key") || status === 401) return "La clé ElevenLabs est refusée : vérifie ELEVENLABS_API_KEY.";
  if (code.includes("paid_plan_required") || status === 402) {
    return "Le plan gratuit ElevenLabs n’autorise pas cette voix par l’API : choisis une voix par défaut (« premade ») ou passe à un plan payant.";
  }
  if (code.includes("missing_permissions")) return "La clé ElevenLabs n’a pas la permission « Text to Speech ».";
  if (code.includes("concurrent_limit_exceeded") || code.includes("too_many_concurrent_requests")) {
    return "ElevenLabs est saturé par des générations en parallèle, réessaie dans quelques secondes.";
  }
  if (code.includes("quota_exceeded")) return "Quota de caractères ElevenLabs épuisé pour ce mois.";
  if (status === 429) return "ElevenLabs limite le nombre de requêtes, réessaie dans quelques secondes.";
  if (code.includes("already_running")) return "ElevenLabs ajoute encore cette voix à ton compte, réessaie dans quelques secondes.";
  if (status === 404 || code.includes("voice_not_found")) return "Voix ElevenLabs introuvable : vérifie son identifiant.";
  return `Le service de voix a refusé la demande (${status}).`;
};

const jsonError = (message: string, status: number) =>
  withSecurityHeaders(NextResponse.json({ message }, { status }));

export async function POST(request: NextRequest) {
  const supabaseAnon = getSupabaseAnonConfig();
  if (!supabaseAnon) return jsonError("Supabase configuration is missing.", 500);

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return jsonError("Missing access token.", 401);
  const user = await fetchSupabaseUser(token, supabaseAnon);
  if (!user?.id) return jsonError("Invalid session.", 401);
  if (!isAdminUser(user)) return jsonError("Not authorized.", 403);

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return jsonError("La voix off n’est pas configurée : ajoutez ELEVENLABS_API_KEY côté serveur.", 503);

  const parsed = narrationVoiceRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return jsonError(`Requête de voix invalide (${issue?.path.join(".") || "corps"} : ${issue?.message ?? "format"}).`, 400);
  }
  const voiceId = parsed.data.voiceId || process.env.ELEVENLABS_VOICE_ID?.trim() || FALLBACK_VOICE_ID;
  const { items, model, expressiveness } = parsed.data;
  const voiceSettings = buildVoiceSettings(model, expressiveness);

  // The narration keeps digits and units for the subtitles; the voice reads them in words.
  const spokenTexts = items.map((item) => toSpokenText(item.text));

  const requestSpeech = (index: number) => fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: spokenTexts[index].spoken,
        model_id: MODEL_IDS[model],
        voice_settings: voiceSettings,
        // v3 does not take neighbouring text; v2 uses it for a continuous delivery.
        ...(model === "v3" ? {} : { previous_text: spokenTexts[index - 1]?.spoken, next_text: spokenTexts[index + 1]?.spoken }),
      }),
      cache: "no-store",
    },
  );

  const synthesize = async (index: number) => {
    const item = items[index];
    let response = await requestSpeech(index);
    // Another generation (or a preview tab) may hold the plan's parallel slots, or the voice may
    // still be joining the account: back off and retry.
    for (const delayMs of CONCURRENCY_RETRY_DELAYS_MS) {
      if (response.status !== 429 && response.status !== 409) break;
      const body = await response.clone().text().catch(() => "");
      if (!isTransientElevenLabsError(response.status, body)) break;
      await wait(delayMs);
      response = await requestSpeech(index);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("ElevenLabs narration error", response.status, body);
      throw new VoiceError(describeElevenLabsError(response.status, body), response.status === 429 ? 429 : response.status >= 500 ? 502 : 400);
    }
    const speech = speechSchema.safeParse(await response.json().catch(() => null));
    if (!speech.success) throw new VoiceError("Réponse de voix invalide.", 502);
    const endTimes = speech.data.alignment?.character_end_times_seconds ?? [];
    const spokenMs = endTimes.length ? endTimes[endTimes.length - 1] * 1_000 : item.text.length * 66;
    return {
      id: item.id,
      text: item.text,
      audioBase64: speech.data.audio_base64,
      durationMs: Math.round(spokenMs + TAIL_MS),
      // Exact per-character timing of the spoken text, mapped back onto the narration characters,
      // only when ElevenLabs aligned exactly the text sent.
      ...(endTimes.length === spokenTexts[index].spoken.length
        ? { characterEndMs: mapSpokenTimingToText(spokenTexts[index], endTimes).map((seconds) => Math.round(seconds * 1_000)) }
        : {}),
    };
  };

  // Two sentences at a time keeps a long story within the function time limit; neighbouring
  // sentences are still passed as context so the delivery stays continuous.
  const clips: Array<Awaited<ReturnType<typeof synthesize>>> = new Array(items.length);
  let next = 0;
  try {
    // The first request alone: with a library voice not yet in the account, it adds the voice, and
    // parallel requests would each try to add it at once (409 already_running).
    clips[0] = await synthesize(0);
    next = 1;
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        clips[index] = await synthesize(index);
      }
    }));
  } catch (error) {
    if (error instanceof VoiceError) return jsonError(error.message, error.status);
    console.error("ElevenLabs narration error", error);
    return jsonError("Le service de voix est injoignable.", 502);
  }

  return withSecurityHeaders(NextResponse.json({ clips }));
}
