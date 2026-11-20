import { NextRequest, NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../../lib/http";
import { synthesizeNarration } from "../../../../../lib/reel-voice";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, isAdminUser } from "../../../../../lib/supabase";
import { narrationVoiceRequestSchema } from "../../../../../lib/video-narration";

export const maxDuration = 60;

const jsonError = (message: string, status: number) =>
  withSecurityHeaders(NextResponse.json({ message }, { status }));

/** ElevenLabs voice-over of the narration (core in lib/reel-voice.ts, shared with the automatic reels). */
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

  const result = await synthesizeNarration(parsed.data, apiKey);
  if (!result.ok) return jsonError(result.message, result.status);
  return withSecurityHeaders(NextResponse.json({ clips: result.clips }));
}
