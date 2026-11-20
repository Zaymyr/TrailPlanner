import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../../../lib/supabase";
import { loadVideoGeneratorDetail } from "../../../../../../lib/video-generator-race";

const paramsSchema = z.object({ id: z.string().uuid() });

const jsonError = (message: string, status: number) =>
  withSecurityHeaders(NextResponse.json({ message }, { status }));

/** Race detail of the video generator (loader in lib/video-generator-race.ts, shared with the automatic reels). */
export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return jsonError("Supabase configuration is missing.", 500);
  }

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return jsonError("Missing access token.", 401);

  const user = await fetchSupabaseUser(token, supabaseAnon);
  if (!user?.id) return jsonError("Invalid session.", 401);
  if (!isAdminUser(user)) return jsonError("Not authorized.", 403);

  const result = await loadVideoGeneratorDetail(supabaseService, parsedParams.data.id);
  if (!result.ok) return jsonError(result.message, result.status);
  return withSecurityHeaders(NextResponse.json(result.detail));
}
