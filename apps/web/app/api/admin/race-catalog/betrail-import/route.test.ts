import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../../../../../lib/supabase", () => ({
  extractBearerToken: vi.fn(() => "admin-token"),
  fetchSupabaseUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" })),
  getSupabaseAnonConfig: vi.fn(() => ({
    supabaseUrl: "https://project.supabase.co",
    supabaseAnonKey: "anon-key",
  })),
  getSupabaseServiceConfig: vi.fn(() => ({
    supabaseUrl: "https://project.supabase.co",
    supabaseServiceRoleKey: "service-key",
  })),
  isAdminUser: vi.fn(() => true),
}));

import { parseDistanceKm, parseElevationM } from "./format-parsers";
import { POST } from "./route";

const researchRequest = () => {
  const fields = {race_date:"2099-06-20", location:"Saint-Aubin-sur-Gaillon",distance_km:"12",start_time:"09:00",aid_stations:'[{"name":"Marnoz","distanceKm":6}]'};
  const provenance = Object.fromEntries(Object.entries(fields).map(([field,value])=>[field,{value,evidence:`Source ${value}`,source_url:"https://trail-exemple.fr/course",method:"llm",status:"verified",edition_year:"2099"}]));
  return {importKind:"catalog_research_v2",raceUrl:"https://www.betrail.run/race/example/2025",raceName:"Trail Exemple",date:"2099-06-20",officialWebsite:"https://trail-exemple.fr",locationText:fields.location,
    formats:[{distance:"12km",elevation:"",name:"Le parcours long",research:{schemaVersion:"2",formatKey:"format-test",fields,provenance,candidates:{city:"Vernon",elevation_gain_m:"477"},route:{url:"",status:"not_processed",sha256:""}}}],action:"import"};
};

const requestFor = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/admin/race-catalog/betrail-import", {
    method: "POST",
    headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("parseDistanceKm / parseElevationM", () => {
  it("parses BeTrail distance and elevation labels", () => {
    expect(parseDistanceKm("19km")).toBe(19);
    expect(parseDistanceKm("147km")).toBe(147);
    expect(parseElevationM("700 D+")).toBe(700);
    expect(parseElevationM("6000 D+")).toBe(6000);
  });

  it("returns null for unrecognized text", () => {
    expect(parseDistanceKm("?")).toBeNull();
    expect(parseElevationM("?")).toBeNull();
  });
});

describe("BeTrail catalog draft import route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects research with missing or mismatching evidence before any database write", async () => {
    const spy = vi.spyOn(globalThis,"fetch");
    const body=researchRequest(); body.formats[0].research.provenance.location.value="Vernon";
    expect((await POST(requestFor(body))).status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects research referring to another edition or source authority", async () => {
    const body=researchRequest(); body.formats[0].research.provenance.race_date.edition_year="2025";
    expect((await POST(requestFor(body))).status).toBe(400);
    body.formats[0].research.provenance.race_date.edition_year="2099";
    body.formats[0].research.provenance.location.source_url="https://sponsor.test/";
    expect((await POST(requestFor(body))).status).toBe(400);
  });

  it("preserves verified location, schedule, stations and provenance in a hidden draft", async () => {
    const spy=vi.spyOn(globalThis,"fetch").mockImplementation(async(input,init)=>{
      if (init?.method !== "POST") return new Response("[]",{status:200});
      const body=JSON.parse(String(init.body));
      if (String(input).includes("/race_events")) return new Response(JSON.stringify([{...body,id:"22222222-2222-2222-2222-222222222222"}]),{status:201});
      return new Response(JSON.stringify([body]),{status:201});
    });
    expect((await POST(requestFor(researchRequest()))).status).toBe(200);
    const [,init]=spy.mock.calls.find(([url,init])=>String(url).endsWith("/rest/v1/races") && init?.method==="POST")!;
    const inserted=JSON.parse(String(init?.body));
    expect(inserted.location_text).toBe("Saint-Aubin-sur-Gaillon");
    expect(inserted.organizer_details.schedule.startTime).toBe("09:00");
    expect(inserted.organizer_details.catalogResearch.fields.aid_stations).toContain('"distanceKm":6');
    expect(inserted.organizer_details.catalogResearch.candidates.elevation_gain_m).toBe("477");
    expect(inserted.elevation_gain_m).toBeNull();
    expect(inserted.missing_required_fields).not.toContain("elevation_gain_m");
    expect(inserted.data_status).toBe("draft"); expect(inserted.is_live).toBe(false);
    expect(spy.mock.calls.some(([url])=>String(url).includes("race_date=eq.2099-06-20"))).toBe(true);
  });

  it("rejects a non-betrail.run raceUrl", async () => {
    const response = await POST(
      requestFor({
        raceUrl: "https://example.com/race/1",
        raceName: "Trail exemple",
        formats: [{ distance: "19km", elevation: "700 D+" }],
        action: "import",
      })
    );

    expect(response.status).toBe(400);
  });

  it("previews without writing to Supabase", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } })
    );

    const response = await POST(
      requestFor({
        raceUrl: "https://www.betrail.run/race/example/2026",
        raceName: "Trail Exemple",
        date: "2026-03-14",
        officialWebsite: "https://trail-exemple.fr",
        formats: [{ distance: "19km", elevation: "700 D+" }],
        action: "preview",
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.preview.formats[0]).toMatchObject({ distanceKm: 19, elevationGainM: 700 });
    expect(fetchSpy.mock.calls.every(([, init]) => !init || init.method !== "POST")).toBe(true);
  });

  it("creates a draft event and a draft race per format, always forced to data_status=draft and is_live=false", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.includes("/rest/v1/race_events") && method === "GET") {
        return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/rest/v1/race_events") && method === "POST") {
        const created = { id: "22222222-2222-2222-2222-222222222222", name: "Trail Exemple", race_date: "2026-03-14", website_url: "https://trail-exemple.fr" };
        return new Response(JSON.stringify([created]), { status: 201, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/rest/v1/races") && method === "GET") {
        return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/rest/v1/races") && method === "POST") {
        const body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify([body]), { status: 201, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    const response = await POST(
      requestFor({
        raceUrl: "https://www.betrail.run/race/example/2026",
        raceName: "Trail Exemple",
        date: "2026-03-14",
        officialWebsite: "https://trail-exemple.fr",
        formats: [
          { distance: "19km", elevation: "700 D+" },
          { distance: "10km", elevation: "?" },
        ],
        action: "import",
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.createdRaces).toHaveLength(2);
    for (const race of json.createdRaces) {
      expect(race.data_status).toBe("draft");
      expect(race.is_live).toBe(false);
    }
    expect(json.createdRaces[1].elevation_gain_m).toBeNull();
    expect(json.createdRaces[1].missing_required_fields).not.toContain("elevation_gain_m");
    expect(fetchSpy).toHaveBeenCalled();
  });
});
