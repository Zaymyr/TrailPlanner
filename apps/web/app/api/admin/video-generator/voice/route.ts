import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../lib/http";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, isAdminUser } from "../../../../../lib/supabase";
import { narrationVoiceRequestSchema } from "../../../../../lib/video-narration";

export const maxDuration = 60;

// ElevenLabs premade voice used when neither the request nor ELEVENLABS_VOICE_ID names one.
const FALLBACK_VOICE_ID = "pNInz6obpgDQGcFmaJgB";
const MODEL_ID = "eleven_multilingual_v2";
// A short tail so the last syllable is not cut when the next clip starts right after.
const TAIL_MS = 150;

const speechSchema = z.object({
  audio_base64: z.string(),
  alignment: z.object({ character_end_times_seconds: z.array(z.number()) }).nullable().optional(),
});

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
  if (!parsed.success) return jsonError("Requête de voix invalide.", 400);
  const voiceId = parsed.data.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? FALLBACK_VOICE_ID;
  const { items } = parsed.data;

  const clips = [];
  // Sequential on purpose: neighbouring sentences are passed as context for a continuous delivery.
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: item.text,
          model_id: MODEL_ID,
          previous_text: items[index - 1]?.text,
          next_text: items[index + 1]?.text,
        }),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      console.error("ElevenLabs narration error", response.status, await response.text().catch(() => ""));
      if (response.status === 401) return jsonError("La clé ElevenLabs est refusée.", 502);
      if (response.status === 404 || response.status === 422) return jsonError("Voix ElevenLabs introuvable : vérifiez son identifiant.", 400);
      if (response.status === 429) return jsonError("Quota ElevenLabs atteint, réessayez plus tard.", 429);
      return jsonError("Le service de voix est indisponible.", 502);
    }
    const speech = speechSchema.safeParse(await response.json().catch(() => null));
    if (!speech.success) return jsonError("Réponse de voix invalide.", 502);
    const endTimes = speech.data.alignment?.character_end_times_seconds ?? [];
    const spokenMs = endTimes.length ? endTimes[endTimes.length - 1] * 1_000 : item.text.length * 66;
    clips.push({ id: item.id, text: item.text, audioBase64: speech.data.audio_base64, durationMs: Math.round(spokenMs + TAIL_MS) });
  }

  return withSecurityHeaders(NextResponse.json({ clips }));
}
