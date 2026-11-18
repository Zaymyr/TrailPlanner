import { describe, expect, it, vi } from "vitest";

import { DEMO_EDITION_ID, DEMO_EVENT_ID, moveDemoRaceToDay, parisIsoDay, shiftProgrammeDates } from "./demo-race-refresh";

const config = { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service" } as never;
const RACES = [{ id: "race-a", race_date: "2026-11-18" }, { id: "race-b", race_date: "2026-11-18" }];

function supabaseStub(state: { start: string; end: string; races: typeof RACES; programme: unknown }) {
  const writes: Array<{ path: string; body: unknown }> = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace("https://db.example/rest/v1/", "");
    if (init?.method === "PATCH") {
      writes.push({ path: path.split("?")[0]!, body: JSON.parse(String(init.body)) });
      return new Response(null, { status: 204 });
    }
    if (path.startsWith("race_event_editions")) {
      return Response.json([{ id: DEMO_EDITION_ID, event_id: DEMO_EVENT_ID, start_date: state.start, end_date: state.end }]);
    }
    if (path.startsWith("races")) return Response.json(state.races);
    return Response.json([{ organizer_details: { dateRange: { endDate: state.end }, programme: state.programme } }]);
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, writes };
}

describe("demo race refresh", () => {
  it("uses the French calendar day", () => {
    expect(parisIsoDay(new Date("2026-11-18T23:30:00Z"))).toBe("2026-11-19");
    expect(parisIsoDay(new Date("2026-07-01T21:30:00Z"))).toBe("2026-07-01");
    expect(parisIsoDay(new Date("2026-07-01T22:30:00Z"))).toBe("2026-07-02");
  });

  it("moves only dated programme entries", () => {
    expect(shiftProgrammeDates([{ id: "a", date: "2026-11-15" }, { id: "b", date: null }], "2026-11-19"))
      .toEqual([{ id: "a", date: "2026-11-19" }, { id: "b", date: null }]);
    expect(shiftProgrammeDates(null, "2026-11-19")).toBeNull();
  });

  it("widens the edition, moves the formats, narrows the edition, then moves the programme", async () => {
    const { fetchImpl, writes } = supabaseStub({ start: "2026-11-18", end: "2026-11-18", races: RACES, programme: [{ id: "village", date: "2026-11-18" }] });

    const result = await moveDemoRaceToDay(config, "2026-11-19", fetchImpl);

    expect(result).toEqual({ day: "2026-11-19", raceIds: ["race-a", "race-b"], moved: true });
    expect(writes).toEqual([
      { path: "race_event_editions", body: { start_date: "2026-11-18", end_date: "2026-11-19" } },
      { path: "races", body: { race_date: "2026-11-19" } },
      { path: "race_event_editions", body: { start_date: "2026-11-19", end_date: "2026-11-19" } },
      { path: "race_events", body: { organizer_details: { dateRange: { endDate: "2026-11-18" }, programme: [{ id: "village", date: "2026-11-19" }] } } },
    ]);
  });

  it("writes nothing when the demo is already on today", async () => {
    const today = RACES.map((race) => ({ ...race, race_date: "2026-11-19" }));
    const { fetchImpl, writes } = supabaseStub({ start: "2026-11-19", end: "2026-11-19", races: today, programme: [{ id: "village", date: "2026-11-19" }] });

    await expect(moveDemoRaceToDay(config, "2026-11-19", fetchImpl)).resolves.toMatchObject({ moved: false });
    expect(writes).toEqual([]);
  });

  it("refuses an edition that does not belong to the demo event", async () => {
    const fetchImpl = vi.fn(async () => Response.json([{ id: DEMO_EDITION_ID, event_id: "other-event", start_date: "2026-11-18", end_date: "2026-11-18" }]));
    await expect(moveDemoRaceToDay(config, "2026-11-19", fetchImpl as unknown as typeof fetch)).rejects.toThrow("Demo edition not found");
  });
});
