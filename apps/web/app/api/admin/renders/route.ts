import { readRendersQuery } from "../../../../lib/admin-renders";
import { loadAdminRenders } from "../../../../lib/admin-renders-server";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../lib/video-render-api";

export const dynamic = "force-dynamic";

/**
 * « Rendus » of the console: every render (manual and automatic reels, flyovers, carousels) in one
 * list. `?periode=24h|7j|30j|tout`, `?type=manuel,auto,survol,carrousel`, `?statut=actif,termine,echec`,
 * `?page=`, `?rendu=<id>` (the render of the open side panel). Read-only; deleting a render stays
 * `DELETE /api/admin/video-generator/render-jobs/<id>`. Admin session only: a missing Google Cloud
 * configuration only removes the MP4 links.
 */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const { supabase } = gate.value;
  try {
    const query = readRendersQuery(new URL(request.url).searchParams);
    return renderJson(await loadAdminRenders({ supabase, request, query }));
  } catch (error) {
    console.error("Admin renders read failed", error instanceof Error ? error.message : error);
    return renderJsonError("Les rendus n’ont pas pu être lus.", 502);
  }
}
