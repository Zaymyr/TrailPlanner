import { billingEditionsResponseSchema } from "../../../../../lib/admin-billing";
import { loadBillingEditions } from "../../../../../lib/admin-billing-server";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../../lib/video-render-api";

export const dynamic = "force-dynamic";

/** Editions (event, year, active pack) for the « Nouvelle facture » and « Enregistrer un virement » pickers. */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    const editions = await loadBillingEditions(gate.value.supabase);
    return renderJson(billingEditionsResponseSchema.parse({ editions }));
  } catch (error) {
    console.error("Admin billing editions failed", error instanceof Error ? error.message : error);
    return renderJsonError("Les éditions n’ont pas pu être chargées.", 502);
  }
}
