import { withAdminAudit, auditBody, auditResponse } from "../../../../../lib/admin-audit-log";
import { z } from "zod";

import { CRON_RUN_KEYS, CRON_RUN_PATHS, type CronRunKey } from "../../../../../lib/admin-system-health";
import { checkRateLimitAsync } from "../../../../../lib/http";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../../lib/video-render-api";
import { GET as runCarouselAutomation } from "../../../cron/carousel-automation/route";
import { GET as runDemoRaceRefresh } from "../../../cron/demo-race-refresh/route";
import { GET as runFlyoverOrders } from "../../../cron/flyover-orders/route";
import { GET as runOrganizerImportCleanup } from "../../../cron/organizer-import-cleanup/route";
import { GET as runReelAutomation } from "../../../cron/reel-automation/route";
import { GET as runRevenueCatReconciliation } from "../../../cron/revenuecat-reconciliation/route";
import { GET as runSocialPostsPublish } from "../../../cron/social-posts-publish/route";
import { GET as runTraceDeTrailEnrichment } from "../../../cron/tracedetrail-catalog-enrichment/route";

export const dynamic = "force-dynamic";
// The longest cron route (reels, carousels, flyovers) may take 5 minutes.
export const maxDuration = 300;

const HANDLERS: Record<CronRunKey, (request: Request) => Promise<Response>> = {
  "social-posts-publish": runSocialPostsPublish,
  "reel-automation": runReelAutomation,
  "carousel-automation": runCarouselAutomation,
  "flyover-orders": runFlyoverOrders,
  "demo-race-refresh": runDemoRaceRefresh,
  "organizer-import-cleanup-hourly": runOrganizerImportCleanup,
  "revenuecat-reconciliation": runRevenueCatReconciliation,
  "tracedetrail-catalog-enrichment": runTraceDeTrailEnrichment,
};

const bodySchema = z.object({ job: z.enum(CRON_RUN_KEYS) });

/** Headers of the admin request the cron handlers read (Google workload identity on Vercel). */
const FORWARDED_HEADERS = ["x-vercel-oidc-token", "x-forwarded-for"];

/**
 * Manual run of one pg_cron task (Maintenance and Automatisations): the cron route handler is invoked
 * in-process with `Authorization: Bearer CRON_SECRET`, exactly as pg_net calls it, so the secret never
 * leaves the server and no URL is built from the request host. Only the allow-listed pg_net jobs can
 * run (not the push reminders, an Edge Function); 2 runs per job and per minute at most.
 */
async function postRoute(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return renderJsonError("Tâche inconnue.", 400);
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return renderJsonError("CRON_SECRET absent : la relance manuelle est impossible.", 503);

  const rateLimit = await checkRateLimitAsync(`admin-cron-run:${parsed.data.job}`, 2, 60_000);
  if (!rateLimit.allowed) return renderJsonError("Cette tâche vient d’être lancée : réessaie dans une minute.", 429);

  const headers = new Headers({ authorization: `Bearer ${cronSecret}`, "content-type": "application/json" });
  FORWARDED_HEADERS.forEach((name) => {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  });
  const cronRequest = new Request(new URL(CRON_RUN_PATHS[parsed.data.job], request.url), { method: "POST", headers, body: "{}" });
  const startedAt = Date.now();
  try {
    const response = await HANDLERS[parsed.data.job](cronRequest);
    const result = (await response.json().catch(() => null)) as unknown;
    console.info("Admin manual cron run", { job: parsed.data.job, by: gate.value.userId, status: response.status });
    return renderJson({ job: parsed.data.job, ok: response.ok, status: response.status, durationMs: Date.now() - startedAt, result });
  } catch (error) {
    console.error("Admin manual cron run failed", parsed.data.job, error instanceof Error ? error.message : error);
    return renderJsonError("La tâche a échoué avant de répondre.", 502);
  }
}

export const POST = withAdminAudit(postRoute, {
  action: "maintenance.cron-run",
  targetType: "system",
  targetId: (c) => auditBody(c).job as string | undefined,
  summary: (c) => `Tâche planifiée « ${auditBody(c).job ?? "?"} » relancée à la main`,
  failed: (c) => (auditResponse(c).ok === false ? `La tâche a répondu ${auditResponse(c).status ?? "en erreur"}.` : null),
  after: (c) => ({ job: auditBody(c).job, status: auditResponse(c).status, durationMs: auditResponse(c).durationMs }),
});
