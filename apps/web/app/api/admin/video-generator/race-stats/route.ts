import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../../lib/video-render-api";
import { readPublicationMarks } from "../../../../../lib/social-posts";
import { readVideoRaceStats } from "../../../../../lib/video-narrations";

/** Per race: finished background videos, saved narration and Instagram publication, shown in the race picker. */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    const [stats, marks] = await Promise.all([
      readVideoRaceStats(gate.value.supabase),
      // The picker works without the publication marks: a failure only hides them.
      readPublicationMarks(gate.value.supabase).catch(() => ({ byRace: {} as Record<string, never> })),
    ]);
    const races: Record<string, (typeof stats)[string] & { publication: (typeof marks.byRace)[string] | null }> = {};
    for (const raceId of new Set([...Object.keys(stats), ...Object.keys(marks.byRace)])) {
      races[raceId] = { ...(stats[raceId] ?? { videos: 0, narration: false, voice: false }), publication: marks.byRace[raceId] ?? null };
    }
    return renderJson({ races });
  } catch (error) {
    console.error("Video race stats failed", error instanceof Error ? error.message : error);
    return renderJsonError("Les statistiques vidéo n’ont pas pu être lues.", 502);
  }
}
