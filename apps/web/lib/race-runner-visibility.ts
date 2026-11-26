// Runner visibility of a race for the display-only public routes (/api/race-weather,
// /api/race-terrain), read with the service key.

import { z } from "zod";

import type { SupabaseServiceConfig } from "./supabase";

/** `races` columns (and the embedded event) the rule needs. */
export const RUNNER_VISIBILITY_RACE_COLUMNS = ["id", "event_id", "edition_id", "is_public", "is_live", "racebook_preview_is_visible"];

export type RunnerVisibilityRace = {
  event_id: string | null;
  edition_id?: string | null;
  is_public?: boolean | null;
  is_live?: boolean | null;
  racebook_preview_is_visible?: boolean | null;
};

export type RunnerVisibilityEvent = { is_live?: boolean | null } | null;

const editionSchema = z.object({ is_visible: z.boolean().nullable().optional() });

/**
 * Mirrors the anon branches of the `races_select` policy: a public live format, or a public
 * preview-visible format of a live event and visible edition (the mobile catalog's private state).
 */
export async function isRaceRunnerVisible(
  config: SupabaseServiceConfig,
  race: RunnerVisibilityRace,
  event: RunnerVisibilityEvent,
): Promise<boolean> {
  if (race.is_public !== true) return false;
  if (event && event.is_live === false) return false;
  if (race.is_live === true) return true;
  if (race.racebook_preview_is_visible !== true || !race.event_id || event?.is_live !== true) return false;
  if (!race.edition_id) return true;
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/race_event_editions?id=eq.${encodeURIComponent(race.edition_id)}&select=is_visible&limit=1`,
    {
      headers: { apikey: config.supabaseServiceRoleKey, Authorization: `Bearer ${config.supabaseServiceRoleKey}` },
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`Supabase read failed (${response.status})`);
  const [edition] = z.array(editionSchema).parse(await response.json());
  return edition?.is_visible === true;
}
