import { NextRequest, NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../../lib/http";
import { WRITER_NOT_CONFIGURED, writeInstagramCaption } from "../../../../../lib/reel-writer";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, isAdminUser } from "../../../../../lib/supabase";
import { instagramCaptionRequestSchema } from "../../../../../lib/video-narration";

export const maxDuration = 60;

const jsonError = (message: string, status: number) =>
  withSecurityHeaders(NextResponse.json({ message }, { status }));

/** Instagram description of a full reel (core in lib/reel-writer.ts, shared with the automatic reels). */
export async function POST(request: NextRequest) {
  const supabaseAnon = getSupabaseAnonConfig();
  if (!supabaseAnon) return jsonError("Supabase configuration is missing.", 500);

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return jsonError("Missing access token.", 401);
  const user = await fetchSupabaseUser(token, supabaseAnon);
  if (!user?.id) return jsonError("Invalid session.", 401);
  if (!isAdminUser(user)) return jsonError("Not authorized.", 403);

  if (!process.env.ANTHROPIC_API_KEY) return jsonError(WRITER_NOT_CONFIGURED, 503);

  const parsed = instagramCaptionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return jsonError(`Requête invalide (${issue?.path.join(".") || "corps"} : ${issue?.message ?? "format"}).`, 400);
  }

  const result = await writeInstagramCaption(parsed.data);
  if (!result.ok) return jsonError(result.message, result.status);
  return withSecurityHeaders(NextResponse.json(result.value));
}
