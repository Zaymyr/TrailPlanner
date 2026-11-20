import { buildRaceDataGaps, loadGapFormats } from "../../../../lib/race-data-gaps";
import { createReelAutomationRepository } from "../../../../lib/reel-automation";
import { parisToday } from "../../../../lib/reel-planner";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../lib/video-render-api";

export const dynamic = "force-dynamic";

/** « GPX à traiter »: upcoming formats whose missing GPX, aid stations or D+ block a reel or a carousel. */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const { supabase } = gate.value;
  try {
    const [formats, settings] = await Promise.all([loadGapFormats(supabase), createReelAutomationRepository(supabase).getSettings()]);
    const today = parisToday();
    return renderJson({ today, leadDays: settings.lead_days, gaps: buildRaceDataGaps(formats, today, settings.lead_days) });
  } catch (error) {
    console.error("Race data gaps read failed", error instanceof Error ? error.message : error);
    return renderJsonError("La liste des données manquantes n’a pas pu être lue.", 502);
  }
}
