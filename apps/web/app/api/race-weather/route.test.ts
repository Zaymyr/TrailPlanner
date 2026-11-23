import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("../../../lib/supabase", () => ({
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" }),
}));
vi.mock("../../../lib/gpx/parseGpx", () => ({
  parseGpx: () => ({
    points: [
      { lat: 45, lng: 6, ele: 1000, distKmCum: 0 },
      { lat: 45.1, lng: 6, ele: 1200, distKmCum: 10 },
      { lat: 45.2, lng: 6, ele: 1100, distKmCum: 20 },
    ],
  }),
}));

const raceId = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-11-23T10:00:00Z");

const raceRow = (overrides: Record<string, unknown> = {}) => ({
  id: raceId,
  event_id: "22222222-2222-4222-8222-222222222222",
  edition_id: "33333333-3333-4333-8333-333333333333",
  race_date: "2026-11-25",
  distance_km: 20,
  start_lat: 45,
  start_lng: 6,
  gpx_storage_path: "races/course-v1.gpx",
  organizer_details: { schedule: { startTime: "08:30" } },
  is_public: true,
  is_live: true,
  racebook_preview_is_visible: true,
  race_events: { is_live: true, location_country_code: "FR", location_region_code: "84" },
  ...overrides,
});

const metBody = {
  properties: {
    timeseries: Array.from({ length: 100 }, (_, index) => ({
      time: new Date(Date.parse("2026-11-22T05:00:00Z") + index * 3_600_000).toISOString().replace(".000Z", "Z"),
      data: {
        instant: { details: { air_temperature: 5, wind_speed: 2, relative_humidity: 70, cloud_area_fraction: 40 } },
        next_1_hours: { summary: { symbol_code: "partlycloudy_day" }, details: { precipitation_amount: 0 } },
      },
    })),
  },
};

type Routes = { race?: unknown[]; waves?: unknown[]; aid?: unknown[]; gpx?: Response; met?: () => Response };

function mockFetch(routes: Routes) {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/rest/v1/races?")) return Response.json(routes.race ?? [raceRow()]);
    if (url.includes("/rest/v1/race_start_waves?")) return Response.json(routes.waves ?? []);
    if (url.includes("/rest/v1/race_aid_stations?")) return Response.json(routes.aid ?? [{ name: "Refuge", km: 10, order_index: 0 }]);
    if (url.includes("/storage/v1/object/race-gpx/")) return routes.gpx ?? new Response("<gpx />");
    if (url.startsWith("https://api.met.no/")) {
      return routes.met
        ? routes.met()
        : Response.json(metBody, { headers: { Expires: "Mon, 23 Nov 2026 10:40:00 GMT" } });
    }
    throw new Error(`Unexpected fetch ${url}`);
  });
}

const call = (id = raceId, ip = "203.0.113.1") =>
  GET(new NextRequest(`http://localhost/api/race-weather?raceId=${id}`, { headers: { "x-forwarded-for": ip } }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GET /api/race-weather", () => {
  it("returns the forecast along the course with the earliest SAS as start", async () => {
    const fetchMock = mockFetch({ waves: [{ start_time: "07:15:00" }] });
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=1800, stale-while-revalidate=3600");
    const body = await response.json();
    expect(body).toMatchObject({
      status: "forecast",
      raceDate: "2026-11-25",
      startAt: "2026-11-25T06:15:00Z",
      startTimeIsEstimated: false,
      timeZone: "Europe/Paris",
      windowStart: "2026-11-25T04:00:00Z",
      expiresAt: "2026-11-23T10:40:00Z",
      source: { provider: "met_norway", attribution: "Données météo : MET Norway (CC BY 4.0)" },
    });
    expect(body.points.map((point: { id: string }) => point.id)).toEqual(["start", "aid-0", "finish"]);
    expect(body.points[0].hours[0]).toMatchObject({ time: "2026-11-25T04:00:00Z", temperatureC: 5, windSpeedKph: 7.2 });

    const metCalls = fetchMock.mock.calls.filter(([url]) => String(url).startsWith("https://api.met.no/"));
    expect(metCalls).toHaveLength(3);
    const [metUrl, metInit] = metCalls[0];
    expect(String(metUrl)).toContain("lat=45.0000&lon=6.0000&altitude=1000");
    expect((metInit as RequestInit & { next?: { revalidate?: number } }).next?.revalidate).toBe(3600);
    expect(new Headers(metInit?.headers).get("user-agent")).toBe("PaceYourself/1.0 (+https://pace-yourself.com)");
  });

  it("defaults to 07:00 local and a start point when there is no start time nor GPX", async () => {
    mockFetch({ race: [raceRow({ organizer_details: null, gpx_storage_path: null })] });
    const body = await (await call()).json();
    expect(body).toMatchObject({ status: "forecast", startAt: "2026-11-25T06:00:00Z", startTimeIsEstimated: true });
    expect(body.points).toHaveLength(1);
    expect(body.points[0]).toMatchObject({ id: "start", altitudeM: null });
  });

  it("answers too_early beyond the MET horizon without calling MET", async () => {
    const fetchMock = mockFetch({ race: [raceRow({ race_date: "2026-12-20" })] });
    const response = await call();
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=21600, stale-while-revalidate=3600");
    expect(await response.json()).toEqual({ status: "too_early", raceId, raceDate: "2026-12-20", availableFrom: "2026-12-11" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("answers no_date and past without caching", async () => {
    mockFetch({ race: [raceRow({ race_date: null })] });
    const noDate = await call();
    expect(noDate.headers.get("cache-control")).toBe("no-store");
    expect(await noDate.json()).toEqual({ status: "unavailable", raceId, reason: "no_date" });

    vi.restoreAllMocks();
    mockFetch({ race: [raceRow({ race_date: "2026-11-21" })] });
    expect(await (await call()).json()).toEqual({ status: "unavailable", raceId, reason: "past" });

    vi.restoreAllMocks();
    mockFetch({ race: [raceRow({ race_date: "2026-11-22" })] });
    expect((await (await call()).json()).status).toBe("forecast");
  });

  it("answers no_route without GPX nor start coordinates", async () => {
    mockFetch({ race: [raceRow({ gpx_storage_path: null, start_lat: null, start_lng: null })] });
    expect(await (await call()).json()).toEqual({ status: "unavailable", raceId, reason: "no_route" });
  });

  it("keeps the points MET answered and reports provider_error when none did", async () => {
    let metCall = 0;
    mockFetch({
      met: () => {
        metCall += 1;
        return metCall === 2 ? new Response("busy", { status: 503 }) : Response.json(metBody);
      },
    });
    const partial = await (await call()).json();
    expect(partial.status).toBe("forecast");
    expect(partial.points).toHaveLength(2);

    vi.restoreAllMocks();
    mockFetch({ met: () => new Response("busy", { status: 503 }) });
    const failed = await call();
    expect(failed.headers.get("cache-control")).toBe("no-store");
    expect(await failed.json()).toEqual({ status: "unavailable", raceId, reason: "provider_error" });
  });

  it("returns 404 for unknown or runner-hidden races", async () => {
    mockFetch({ race: [] });
    expect((await call()).status).toBe(404);

    vi.restoreAllMocks();
    mockFetch({ race: [raceRow({ is_public: false })] });
    expect((await call()).status).toBe(404);

    vi.restoreAllMocks();
    mockFetch({ race: [raceRow({ race_events: { is_live: false } })] });
    expect((await call()).status).toBe(404);
  });

  it("rejects an invalid race id", async () => {
    expect((await call("not-a-uuid")).status).toBe(400);
  });
});
