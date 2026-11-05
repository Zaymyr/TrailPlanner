import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../../lib/video-render-api";
import { readVideoRaceStats } from "../../../../../lib/video-narrations";

/** Per race: finished background videos and saved narration, shown in the race picker. */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    return renderJson({ races: await readVideoRaceStats(gate.value.supabase) });
  } catch (error) {
    console.error("Video race stats failed", error instanceof Error ? error.message : error);
    return renderJsonError("Les statistiques vidéo n’ont pas pu être lues.", 502);
  }
}
