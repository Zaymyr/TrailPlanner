import { NextRequest, NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../../lib/http";
import { WRITER_NOT_CONFIGURED, writeNarrationScript } from "../../../../../lib/reel-writer";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, isAdminUser } from "../../../../../lib/supabase";
import { narrationScriptRequestSchema } from "../../../../../lib/video-narration";

// Room for a draft and, when it runs over its word budget, a quick revision.
export const maxDuration = 120;

const jsonError = (message: string, status: number) =>
  withSecurityHeaders(NextResponse.json({ message }, { status }));

/** Narration of every beat (core in lib/reel-writer.ts, shared with the automatic reels). */
export async function POST(request: NextRequest) {
  const supabaseAnon = getSupabaseAnonConfig();
  if (!supabaseAnon) return jsonError("Supabase configuration is missing.", 500);

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return jsonError("Missing access token.", 401);
  const user = await fetchSupabaseUser(token, supabaseAnon);
  if (!user?.id) return jsonError("Invalid session.", 401);
  if (!isAdminUser(user)) return jsonError("Not authorized.", 403);

  if (!process.env.ANTHROPIC_API_KEY) return jsonError(WRITER_NOT_CONFIGURED, 503);

  const parsed = narrationScriptRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    // Admin-only route: naming the offending field makes a limit or data problem diagnosable.
    const issue = parsed.error.issues[0];
    console.error("Video narration script request rejected", parsed.error.issues.slice(0, 5));
    return jsonError(`Requête de script invalide (${issue?.path.join(".") || "corps"} : ${issue?.message ?? "format"}).`, 400);
  }

  const result = await writeNarrationScript(parsed.data);
  if (!result.ok) return jsonError(result.message, result.status);
  return withSecurityHeaders(NextResponse.json(result.value));
}
