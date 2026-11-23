import { systemHealthResponseSchema } from "../../../../../lib/admin-system-health";
import { loadSystemHealth } from "../../../../../lib/admin-system-health-server";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../../lib/video-render-api";

export const dynamic = "force-dynamic";

/**
 * Santé des systèmes (admin console, lot 3): scheduled tasks (pg_cron jobs and their last run, the
 * Vercel crons never called), pg_net HTTP responses, transactional e-mail journal and payment
 * journals, plus the three dashboard lines. Read-only, service role, no third-party API call.
 */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    const { lines: _lines, incidents: _incidents, ...health } = await loadSystemHealth(gate.value.supabase);
    return renderJson(systemHealthResponseSchema.parse(health));
  } catch (error) {
    console.error("Admin system health failed", error instanceof Error ? error.message : error);
    return renderJsonError("La santé des systèmes n’a pas pu être lue.", 502);
  }
}
