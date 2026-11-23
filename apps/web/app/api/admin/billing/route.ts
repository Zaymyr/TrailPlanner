import { billingResponseSchema, readBillingQuery } from "../../../../lib/admin-billing";
import { loadBillingRegister } from "../../../../lib/admin-billing-server";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../lib/video-render-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * « Ventes & facturation » register: one line per transaction (organizer packs by Stripe or bank
 * transfer, manual invoices, flyover orders, runner purchases), newest first, with the KPI of the
 * period. `?du=&au=` (Paris days, inclusive) or `?periode=mois|mois-precedent|30j|annee|tout`,
 * `?source=packs,factures,survols,coureurs`, `?statut=paye,a-regler,…`, `?recherche=`, `?edition=<id>`,
 * `?page=`; `?export=1` returns every matching line (capped) for the CSV export. Read-only.
 */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    const params = new URL(request.url).searchParams;
    const register = await loadBillingRegister(gate.value.supabase, readBillingQuery(params), { exportAll: params.get("export") === "1" });
    return renderJson(billingResponseSchema.parse(register));
  } catch (error) {
    console.error("Admin billing register failed", error instanceof Error ? error.message : error);
    return renderJsonError("Le registre des ventes n’a pas pu être chargé.", 502);
  }
}
