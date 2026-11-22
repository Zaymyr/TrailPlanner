import { loadAdminInbox } from "../../../../lib/admin-inbox-server";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../lib/video-render-api";

export const dynamic = "force-dynamic";
// « Données de course » reads the live catalog and its aid stations.
export const maxDuration = 60;

/**
 * « À traiter » queue of the admin console: every pending item, oldest first, with the console URL
 * where it is handled. A source that cannot be read is reported in `sources`; the others still load.
 */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    return renderJson(await loadAdminInbox(gate.value.supabase));
  } catch (error) {
    console.error("Admin inbox failed", error instanceof Error ? error.message : error);
    return renderJsonError("La file « À traiter » n’a pas pu être lue.", 502);
  }
}
