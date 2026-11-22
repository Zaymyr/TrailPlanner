import { adminOverviewResponseSchema } from "../../../../lib/admin-overview";
import { loadAdminOverview } from "../../../../lib/admin-overview-server";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../lib/video-render-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * « Vue d'ensemble » of the admin console: KPI of the period and of the previous one, 30-day activity,
 * funnel, revenue by source, next 7 days, systems health and recent activity, aggregated from the
 * existing sources (`lib/admin-overview-server.ts`). `?range=today|7d|30d|custom&from=&to=` (Paris days,
 * inclusive). Each block carries its own `ok` / `error` status.
 */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    const params = new URL(request.url).searchParams;
    const overview = await loadAdminOverview(gate.value.supabase, { range: params.get("range"), from: params.get("from"), to: params.get("to") });
    return renderJson(adminOverviewResponseSchema.parse(overview));
  } catch (error) {
    console.error("Admin overview failed", error instanceof Error ? error.message : error);
    return renderJsonError("La vue d’ensemble n’a pas pu être chargée.", 502);
  }
}
