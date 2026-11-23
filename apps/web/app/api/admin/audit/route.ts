import { auditResponseSchema, readAuditQuery } from "../../../../lib/admin-audit";
import { loadAdminAudit } from "../../../../lib/admin-audit-server";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../lib/video-render-api";

export const dynamic = "force-dynamic";

/**
 * « Journal » of the console (Système › Journal): the admin actions written by the admin routes, newest
 * first. `?du=&au=` (Paris days, inclusive), `?acteur=<userId>`, `?action=premium,billing.invoice-settle`
 * (family prefix or exact action), `?cible=<id or type>`, `?statut=reussie|echec`, `?recherche=`,
 * `?page=` (50 lines), `?entree=<id>` (one line, other filters ignored), `?export=1` (every match, 5 000
 * max). Read-only and never journaled itself. Before the lot 7 migration is applied the answer is
 * `available: false` with no entry.
 */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    const params = new URL(request.url).searchParams;
    const audit = await loadAdminAudit(gate.value.supabase, readAuditQuery(params), { exportAll: params.get("export") === "1" });
    return renderJson(auditResponseSchema.parse(audit));
  } catch (error) {
    console.error("Admin audit read failed", error instanceof Error ? error.message : error);
    return renderJsonError("Le journal n’a pas pu être lu.", 502);
  }
}
