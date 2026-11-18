import { serviceHeaders } from "./organizer";
import type { SupabaseServiceConfig } from "./supabase";

/**
 * Keeps the Trail TST demonstration event on today's date so its Supporter
 * Guide and Livret coureur are always "live" for prospects (printed brochure
 * QR code, /organisateurs demo, in-app search). Only this fixed test event is
 * ever touched.
 */
export const DEMO_EVENT_ID = "7a110000-0000-4000-8000-000000000001";
export const DEMO_EDITION_ID = "41b2143c-cd5c-4e84-9106-398ef9e8ebf0";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar day in France, where the demo event takes place. */
export function parisIsoDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Moves every dated programme entry to `day`; entries without a date are kept as they are. */
export function shiftProgrammeDates(programme: unknown, day: string): unknown {
  if (!Array.isArray(programme)) return programme;
  return programme.map((entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry) && typeof (entry as { date?: unknown }).date === "string"
      ? { ...(entry as Record<string, unknown>), date: day }
      : entry,
  );
}

export type DemoRaceRefreshResult = { day: string; raceIds: string[]; moved: boolean };

type EditionRow = { id: string; event_id: string; start_date: string; end_date: string };
type RaceRow = { id: string; race_date: string | null };
type EventRow = { organizer_details: Record<string, unknown> | null };

async function rest<T>(config: SupabaseServiceConfig, fetchImpl: typeof fetch, path: string, init?: { method: "PATCH"; body: unknown }): Promise<T> {
  const response = await fetchImpl(`${config.supabaseUrl}/rest/v1/${path}`, {
    method: init?.method ?? "GET",
    headers: { ...serviceHeaders(config, init ? "application/json" : ""), ...(init ? { Prefer: "return=minimal" } : {}) },
    body: init ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Demo race refresh failed on ${init?.method ?? "GET"} ${path.split("?")[0]}: ${await response.text()}`);
  return (init ? undefined : await response.json()) as T;
}

/**
 * Moves the demo edition, its formats and its programme to `day`. Returns the
 * format ids so the caller republishes them; `moved` is false when everything
 * was already on `day`.
 */
export async function moveDemoRaceToDay(
  config: SupabaseServiceConfig,
  day: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DemoRaceRefreshResult> {
  if (!ISO_DAY.test(day)) throw new Error(`Invalid demo day: ${day}`);
  const [edition] = await rest<EditionRow[]>(config, fetchImpl, `race_event_editions?id=eq.${DEMO_EDITION_ID}&select=id,event_id,start_date,end_date&limit=1`);
  if (!edition || edition.event_id !== DEMO_EVENT_ID) throw new Error("Demo edition not found for the demo event.");
  const races = await rest<RaceRow[]>(config, fetchImpl, `races?edition_id=eq.${DEMO_EDITION_ID}&event_id=eq.${DEMO_EVENT_ID}&select=id,race_date`);
  const raceIds = races.map((race) => race.id);
  const [event] = await rest<EventRow[]>(config, fetchImpl, `race_events?id=eq.${DEMO_EVENT_ID}&select=organizer_details&limit=1`);
  const details = event?.organizer_details ?? {};
  const programme = shiftProgrammeDates(details.programme, day);

  const alreadyToday = edition.start_date === day && edition.end_date === day
    && races.every((race) => race.race_date === day)
    && JSON.stringify(programme) === JSON.stringify(details.programme);
  if (alreadyToday) return { day, raceIds, moved: false };

  // Formats must stay inside the edition range: widen it, move the formats, then narrow it.
  const editionPath = `race_event_editions?id=eq.${DEMO_EDITION_ID}&event_id=eq.${DEMO_EVENT_ID}`;
  await rest(config, fetchImpl, editionPath, {
    method: "PATCH",
    body: { start_date: edition.start_date < day ? edition.start_date : day, end_date: edition.end_date > day ? edition.end_date : day },
  });
  await rest(config, fetchImpl, `races?edition_id=eq.${DEMO_EDITION_ID}&event_id=eq.${DEMO_EVENT_ID}`, { method: "PATCH", body: { race_date: day } });
  await rest(config, fetchImpl, editionPath, { method: "PATCH", body: { start_date: day, end_date: day } });

  // Re-read after the edition trigger mirrored its dates into the event before writing the programme.
  const [mirrored] = await rest<EventRow[]>(config, fetchImpl, `race_events?id=eq.${DEMO_EVENT_ID}&select=organizer_details&limit=1`);
  const mirroredDetails = mirrored?.organizer_details ?? {};
  if (Array.isArray(mirroredDetails.programme)) {
    await rest(config, fetchImpl, `race_events?id=eq.${DEMO_EVENT_ID}`, {
      method: "PATCH",
      body: { organizer_details: { ...mirroredDetails, programme: shiftProgrammeDates(mirroredDetails.programme, day) } },
    });
  }
  return { day, raceIds, moved: true };
}
