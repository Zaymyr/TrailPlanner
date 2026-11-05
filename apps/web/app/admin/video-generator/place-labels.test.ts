import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchNearestPlaceName, resolveEndpointNames } from "./place-labels";

const saintEtienne = { lat: 45.4397, lon: 4.3872 };
const lyon = { lat: 45.7485, lon: 4.8467 };

describe("endpoint names", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the organizer start place and looks the finish up", async () => {
    const lookup = vi.fn(async () => "Lyon");
    expect(await resolveEndpointNames(saintEtienne, lyon, "Saint-Étienne", lookup)).toEqual({ start: "Saint-Étienne", finish: "Lyon" });
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("names a loop's finish after its start, and survives a failed lookup", async () => {
    const nearby = { lat: saintEtienne.lat + 0.002, lon: saintEtienne.lon };
    expect(await resolveEndpointNames(saintEtienne, nearby, null, async () => "Saint-Étienne")).toEqual({ start: "Saint-Étienne", finish: "Saint-Étienne" });
    expect(await resolveEndpointNames(saintEtienne, lyon, null, async () => { throw new Error("offline"); })).toEqual({ start: null, finish: null });
  });

  it("picks the nearest settlement, not a district or a peak", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ features: [
      { properties: { name: "Gerland", class: "settlement_subdivision", tilequery: { distance: 50 } } },
      { properties: { name: "Villeurbanne", class: "settlement", tilequery: { distance: 3_000 } } },
      { properties: { name: "Lyon", class: "settlement", tilequery: { distance: 900 } } },
    ] })));
    expect(await fetchNearestPlaceName(lyon.lon, lyon.lat, "pk.token")).toBe("Lyon");
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("layers=place_label");
  });
});
