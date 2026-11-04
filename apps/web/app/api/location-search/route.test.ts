import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const photonFeature = (properties: Record<string, string>, coordinates: [number, number]) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates },
  properties: { countrycode: "FR", country: "France", ...properties },
});

const bibracte = photonFeature(
  { name: "Bibracte", street: "Route Jacques-Gabriel Bulliot", postcode: "71990", city: "Saint-Léger-sous-Beuvray", osm_key: "tourism", osm_value: "museum" },
  [4.0225, 46.9227],
);

const nominatimRow = {
  display_name: "Bibracte, Route Jacques-Gabriel Bulliot, 71990 Saint-Léger-sous-Beuvray, France",
  lat: "46.92271",
  lon: "4.02251",
  importance: 0.3,
  place_rank: 30,
  class: "tourism",
  type: "museum",
  address: { tourism: "Bibracte", village: "Saint-Léger-sous-Beuvray" },
};

const search = (query: string, ip: string) =>
  GET(new NextRequest(`http://localhost/api/location-search?q=${encodeURIComponent(query)}`, { headers: { "x-forwarded-for": ip } }));

const mockProviders = (photon: () => Response, nominatim: () => Response) =>
  vi.stubGlobal("fetch", vi.fn(async (input: URL | string) =>
    String(input).startsWith("https://photon.komoot.io/") ? photon() : nominatim()));

describe("GET /api/location-search", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("finds a named place through Photon, outside the country filter dropped, and merges duplicates", async () => {
    mockProviders(
      () => Response.json({ features: [bibracte, photonFeature({ name: "Bibracte", city: "Madrid", countrycode: "ES", osm_key: "shop" }, [-3.7, 40.4])] }),
      () => Response.json([nominatimRow]),
    );

    const response = await search("bibracte", "10.0.0.1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.suggestions).toHaveLength(1);
    expect(body.suggestions[0]).toMatchObject({
      label: "Bibracte, Route Jacques-Gabriel Bulliot, 71990 Saint-Léger-sous-Beuvray, France",
      subtitle: "museum",
    });
    expect(body.suggestions[0].lat).toBeCloseTo(46.9227, 3);
    expect(body.suggestions[0].lng).toBeCloseTo(4.0225, 3);
  });

  it("still answers from Nominatim when Photon is down", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockProviders(() => new Response("down", { status: 503 }), () => Response.json([nominatimRow]));

    const body = await (await search("bibracte", "10.0.0.2")).json();

    expect(body.suggestions.map((suggestion: { label: string }) => suggestion.label)).toEqual([nominatimRow.display_name]);
  });

  it("returns 502 only when both providers fail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockProviders(() => new Response("down", { status: 503 }), () => new Response("down", { status: 503 }));

    const response = await search("bibracte", "10.0.0.3");

    expect(response.status).toBe(502);
  });
});
