import { NextResponse } from "next/server";

import { withSecurityHeaders } from "./http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
  type SupabaseServiceConfig,
} from "./supabase";
import {
  getRenderJob,
  getRenderTokenFromRequest,
  getVideoRenderConfig,
  verifyRenderToken,
  VideoRenderSetupError,
  type VideoRenderConfig,
  type VideoRenderJobRow,
} from "./video-render";

export const renderJsonError = (message: string, status: number) =>
  withSecurityHeaders(NextResponse.json({ message }, { status }));

export const renderJson = (body: unknown, status = 200) =>
  withSecurityHeaders(NextResponse.json(body, { status }));

type Gate<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

const NOT_CONFIGURED = "Rendu en arrière-plan non configuré (variables Google Cloud absentes).";

/** Admin session plus the Supabase service role (saved narrations, video stats). */
export const authorizeVideoAdmin = async (request: Request): Promise<Gate<{
  userId: string;
  supabase: SupabaseServiceConfig;
}>> => {
  const anon = getSupabaseAnonConfig();
  const supabase = getSupabaseServiceConfig();
  if (!anon || !supabase) return { ok: false, response: renderJsonError("Supabase configuration is missing.", 500) };

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return { ok: false, response: renderJsonError("Missing access token.", 401) };
  const user = await fetchSupabaseUser(token, anon);
  if (!user?.id) return { ok: false, response: renderJsonError("Invalid session.", 401) };
  if (!isAdminUser(user)) return { ok: false, response: renderJsonError("Not authorized.", 403) };
  return { ok: true, value: { userId: user.id, supabase } };
};

/** Admin session plus the Supabase service role and the Google Cloud render configuration. */
export const authorizeRenderAdmin = async (request: Request): Promise<Gate<{
  userId: string;
  supabase: SupabaseServiceConfig;
  config: VideoRenderConfig;
}>> => {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate;
  const config = getVideoRenderConfig();
  if (!config) return { ok: false, response: renderJsonError(NOT_CONFIGURED, 503) };
  return { ok: true, value: { ...gate.value, config } };
};

/** The render page: a valid token for this very job, and the job itself. */
export const authorizeRenderPage = async (request: Request, jobId: string): Promise<Gate<{
  supabase: SupabaseServiceConfig;
  config: VideoRenderConfig;
  job: VideoRenderJobRow;
}>> => {
  const supabase = getSupabaseServiceConfig();
  const config = getVideoRenderConfig();
  if (!supabase || !config) return { ok: false, response: renderJsonError(NOT_CONFIGURED, 503) };
  if (!verifyRenderToken(config.tokenSecret, jobId, getRenderTokenFromRequest(request))) {
    return { ok: false, response: renderJsonError("Invalid render token.", 401) };
  }
  const job = await getRenderJob(supabase, jobId);
  if (!job) return { ok: false, response: renderJsonError("Render job not found.", 404) };
  return { ok: true, value: { supabase, config, job } };
};

/** Setup problems (OIDC, IAM) are shown to the admin as is; anything else stays generic. */
export const describeRenderError = (error: unknown, fallback: string) => {
  if (error instanceof VideoRenderSetupError) return error.message;
  console.error(fallback, error);
  return fallback;
};
