import { describe, expect, it } from "vitest";

import {
  aidStationPayload,
  aidStationRowsToDrafts,
  appendAidStationDraft,
  canEnrichFromTraceDeTrail,
  eventEditDefaults,
  eventPatchBody,
  filterRacesByName,
  groupRacesByEvent,
  hasInvalidAidStation,
  imageFileProblem,
  MAX_IMAGE_SIZE,
  normalizeAidStationDrafts,
  raceEditDefaults,
  racePatchBody,
  type RaceEventRow,
  type RaceRow,
} from "./race-catalog-model";

const EVENT_A = "11111111-1111-4111-8111-111111111111";
const EVENT_B = "22222222-2222-4222-8222-222222222222";

const race = (id: string, name: string, patch: Partial<RaceRow> = {}): RaceRow => ({
  id, name, distance_km: 42, elevation_gain_m: 2000, is_live: true, slug: name.toLowerCase(), ...patch,
});
const events: RaceEventRow[] = [
  { id: EVENT_A, name: "Zermatt Trail", location: "Zermatt", race_date: "2026-07-01", thumbnail_url: "https://img/a.jpg" },
  { id: EVENT_B, name: "Aubrac", location: null, race_date: null },
];

describe("race catalog model", () => {
  it("groups races by event, sorted by title, races without event last", () => {
    const groups = groupRacesByEvent([
      race("r1", "Sans événement"),
      race("r2", "Marathon", { event_id: EVENT_A }),
      race("r3", "Ultra", { event_id: EVENT_B }),
      race("r4", "Semi", { event_id: EVENT_A }),
      race("r5", "Embedded", { event_id: null, race_events: { id: "33333333-3333-4333-8333-333333333333", name: "Belledonne" } }),
    ], events, "Sans événement");
    expect(groups.map((group) => [group.title, group.races.map((item) => item.id)])).toEqual([
      ["Aubrac", ["r3"]],
      ["Belledonne", ["r5"]],
      ["Zermatt Trail", ["r2", "r4"]],
      ["Sans événement", ["r1"]],
    ]);
    expect(groups[2]).toMatchObject({ meta: "Zermatt - 2026-07-01", thumbnailUrl: "https://img/a.jpg", isWithoutEvent: false });
    expect(groups[0].meta).toBeNull();
    expect(groups[3]).toMatchObject({ key: "event:none", event: null, isWithoutEvent: true });
  });

  it("filters the list on the race name, case-insensitively", () => {
    const rows = [race("r1", "UTMB"), race("r2", "Trail des Lacs")];
    expect(filterRacesByName(rows, "")).toBe(rows);
    expect(filterRacesByName(rows, "utm").map((item) => item.id)).toEqual(["r1"]);
  });

  it("prepares aid stations: blank rows dropped, decimal comma, invalid ones detected", () => {
    const prepared = normalizeAidStationDrafts([
      { name: " Col ", distanceKm: "12,5", waterRefill: true },
      { name: "", distanceKm: "", waterRefill: false },
      { name: "Sommet", distanceKm: "", waterRefill: false },
    ]);
    expect(prepared.map((station) => [station.name, station.distanceKmValue])).toEqual([["Col", 12.5], ["Sommet", Number.NaN]]);
    expect(hasInvalidAidStation(prepared)).toBe(true);
    expect(hasInvalidAidStation(prepared.slice(0, 1))).toBe(false);
    expect(aidStationPayload(prepared.slice(0, 1))).toEqual([{ name: "Col", distanceKm: 12.5, waterRefill: true }]);
    expect(appendAidStationDraft([{ name: "A", distanceKm: "1", waterRefill: false }])[1]).toEqual({ name: "Ravito 2", distanceKm: "", waterRefill: true });
    expect(aidStationRowsToDrafts([
      { id: "a", name: "Deux", km: 20, water_available: false, order_index: 2 },
      { id: "b", name: "Un", km: 10, water_available: true, order_index: 1 },
    ])).toEqual([{ name: "Un", distanceKm: "10", waterRefill: true }, { name: "Deux", distanceKm: "20", waterRefill: false }]);
  });

  it("checks uploaded images (type, 5 MB)", () => {
    expect(imageFileProblem({ type: "image/gif", size: 10 })).toBe("type");
    expect(imageFileProblem({ type: "image/webp", size: MAX_IMAGE_SIZE + 1 })).toBe("size");
    expect(imageFileProblem({ type: "image/jpeg", size: MAX_IMAGE_SIZE })).toBeNull();
  });

  it("builds the PATCH bodies with only the given fields and empty texts as null", () => {
    expect(racePatchBody({ is_live: false })).toEqual({ is_live: false });
    expect(racePatchBody({ name: "X", event_id: "", elevation_gain_m: "", elevation_loss_m: "", trace_id: "12", location_text: "Gap", external_site_url: "", thumbnail_url: "" })).toEqual({
      name: "X", event_id: null, elevation_loss_m: null, trace_id: "12", location_text: "Gap", external_site_url: null, thumbnail_url: null,
    });
    expect(racePatchBody({ elevation_gain_m: "1 200".replace(" ", ""), elevation_loss_m: "980,5" })).toEqual({ elevation_gain_m: 1200, elevation_loss_m: 980.5 });
    expect(eventPatchBody({ name: "E", short_name: "", location: "", race_date: "2026-06-01", is_live: true })).toEqual({
      name: "E", short_name: null, location: null, race_date: "2026-06-01", is_live: true,
    });
  });

  it("fills the edit forms and detects a Trace de Trail race", () => {
    expect(raceEditDefaults(race("r1", "UTMB", { elevation_gain_m: 9999.6, elevation_loss_m: null, trace_id: 42 }))).toMatchObject({
      name: "UTMB", event_id: "", elevation_gain_m: "10000", elevation_loss_m: "", trace_id: "42", is_live: true,
    });
    expect(eventEditDefaults({ id: EVENT_A, name: "Z", is_live: null })).toMatchObject({ short_name: "", is_live: true });
    expect(eventEditDefaults({ id: EVENT_A, name: "Z", is_live: false }).is_live).toBe(false);
    expect(canEnrichFromTraceDeTrail(race("r", "a", { trace_id: 3 }))).toBe(true);
    expect(canEnrichFromTraceDeTrail(race("r", "a", { trace_provider: "tracedetrail" }))).toBe(true);
    expect(canEnrichFromTraceDeTrail(race("r", "a", { external_site_url: "https://tracedetrail.fr/fr/trace/1" }))).toBe(true);
    expect(canEnrichFromTraceDeTrail(race("r", "a", { external_site_url: "https://utmb.world" }))).toBe(false);
    expect(canEnrichFromTraceDeTrail(null)).toBe(false);
  });
});
