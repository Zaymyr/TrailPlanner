import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  requireOrganizerAuth: vi.fn(),
  requireEventOrganizer: vi.fn(),
  loadEntitlement: vi.fn(),
  loadGrant: vi.fn(),
  resolveAccess: vi.fn(),
  loadAnalytics: vi.fn(),
}));

vi.mock("../../../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => NextResponse.json({ message }, { status }),
  requireOrganizerAuth: mocks.requireOrganizerAuth,
  requireEventOrganizer: mocks.requireEventOrganizer,
  serviceHeaders: () => ({}),
  uuidParamSchema: { safeParse: (value: { id?: string }) => ({ success: Boolean(value.id), data: value }) },
}));
vi.mock("../../../../../../lib/organizer-entitlements", () => ({
  loadOrganizerEditionEntitlement: mocks.loadEntitlement,
  loadOrganizerEditionCapabilityGrant: mocks.loadGrant,
  resolveOrganizerCapabilityAccess: mocks.resolveAccess,
}));
vi.mock("../../../../../../lib/posthog-organizer-analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../lib/posthog-organizer-analytics")>();
  return { ...actual, loadPostHogOrganizerAnalytics: mocks.loadAnalytics };
});

const editionId = "22222222-2222-4222-8222-222222222222";
const eventId = "11111111-1111-4111-8111-111111111111";
const raceId = "33333333-3333-4333-8333-333333333333";
const foreignRaceId = "44444444-4444-4444-8444-444444444444";

const request = (query = "") => new NextRequest(
  `http://localhost/api/organizer/editions/${editionId}/analytics${query}`,
  { headers: { authorization: "Bearer user-token" } },
);

const installSupabaseFetch = (options: { editionStatus?: number; racesStatus?: number; favoriteCount?: number; favoritesStatus?: number; omitFavoriteCount?: boolean } = {}) => vi
  .spyOn(global, "fetch")
  .mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/race_event_editions?")) return Response.json(
      options.editionStatus === 404 ? [] : [{
        id: editionId,
        event_id: eventId,
        start_date: "2026-09-12",
        end_date: "2026-09-13",
      }],
      { status: options.editionStatus === 502 ? 500 : 200 },
    );
    if (url.includes("/races?")) return Response.json([{ id: raceId }], { status: options.racesStatus ?? 200 });
    if (url.includes("/user_favorite_race_events?")) return Response.json([], {
      status: options.favoritesStatus ?? 200,
      headers: options.omitFavoriteCount ? undefined : { "content-range": `*/${options.favoriteCount ?? 7}` },
    });
    throw new Error(`Unexpected fetch: ${url}`);
  });

describe("GET organizer edition analytics", () => {
  beforeEach(() => {
    mocks.requireOrganizerAuth.mockResolvedValue({
      user: { id: "user-1", appMetadata: { role: "user" } },
      serviceConfig: { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service" },
    });
    mocks.requireEventOrganizer.mockResolvedValue(true);
    mocks.loadEntitlement.mockResolvedValue({ tier: "signature", status: "active" });
    mocks.loadGrant.mockResolvedValue(null);
    mocks.resolveAccess.mockReturnValue({ allowed: true, source: "tier" });
    mocks.loadAnalytics.mockResolvedValue({
      summary: { uniqueReaders: 12, totalOpens: 20, averageActiveSeconds: 75, engagementRate: 0.6 },
      daily: [{ date: "2026-09-15", uniqueReaders: 3, totalOpens: 5 }],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("returns 401 before querying Supabase when the session is invalid", async () => {
    mocks.requireOrganizerAuth.mockResolvedValue({ error: NextResponse.json({ message: "Invalid session." }, { status: 401 }) });
    const fetchMock = vi.spyOn(global, "fetch");
    const response = await GET(request(), { params: { id: editionId } });
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects organizers outside the parent event", async () => {
    installSupabaseFetch();
    mocks.requireEventOrganizer.mockResolvedValue({ error: NextResponse.json({ message: "Not authorized." }, { status: 403 }) });
    const response = await GET(request(), { params: { id: editionId } });
    expect(response.status).toBe(403);
    expect(mocks.loadAnalytics).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown edition", async () => {
    installSupabaseFetch({ editionStatus: 404 });
    const response = await GET(request(), { params: { id: editionId } });
    expect(response.status).toBe(404);
  });

  it("rejects an edition without effective analytics access", async () => {
    installSupabaseFetch();
    mocks.resolveAccess.mockReturnValue({ allowed: false, source: null });
    const response = await GET(request(), { params: { id: editionId } });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "Analytics access required." });
    expect(mocks.loadAnalytics).not.toHaveBeenCalled();
  });

  it("rejects a format belonging to another edition without calling PostHog", async () => {
    installSupabaseFetch();
    const response = await GET(request(`?raceId=${foreignRaceId}`), { params: { id: editionId } });
    expect(response.status).toBe(404);
    expect(mocks.loadAnalytics).not.toHaveBeenCalled();
  });

  it("defaults to 30 days and returns typed analytics with the access source", async () => {
    installSupabaseFetch();
    const response = await GET(request(), { params: { id: editionId } });
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      access: { allowed: true, source: "tier" },
      range: "30d",
      raceId: null,
      timing: { cacheTtlSeconds: 900 },
      summary: { uniqueReaders: 12, totalOpens: 20, averageActiveSeconds: 75, engagementRate: 0.6 },
    });
    expect(mocks.loadAnalytics).toHaveBeenCalledWith(expect.objectContaining({
      eventId,
      editionId,
      raceIds: [raceId],
      selectedRaceId: null,
    }));
    expect(fetch).toHaveBeenCalledWith(
      `https://db.example/rest/v1/user_favorite_race_events?event_id=eq.${eventId}&select=user_id&limit=1`,
      expect.objectContaining({
        headers: expect.objectContaining({ Prefer: "count=exact", Range: "0-0" }),
      }),
    );
  });

  it("returns zero favorites when no runner follows the event", async () => {
    installSupabaseFetch({ favoriteCount: 0 });
    const response = await GET(request(), { params: { id: editionId } });
    expect(response.status).toBe(200);
    expect((await response.json()).summary.favoriteCount).toBe(0);
  });

  it("fails safely when Supabase omits the exact favorite count", async () => {
    installSupabaseFetch({ omitFavoriteCount: true });
    const response = await GET(request(), { params: { id: editionId } });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: "Unable to load event favorites." });
    expect(mocks.loadAnalytics).not.toHaveBeenCalled();
  });

  it("reports complimentary access and forwards valid filters", async () => {
    installSupabaseFetch();
    mocks.resolveAccess.mockReturnValue({ allowed: true, source: "complimentary" });
    const response = await GET(request(`?range=7d&raceId=${raceId}`), { params: { id: editionId } });
    expect(response.status).toBe(200);
    expect((await response.json()).access.source).toBe("complimentary");
    expect(mocks.loadAnalytics).toHaveBeenCalledWith(expect.objectContaining({ selectedRaceId: raceId }));
  });

  it("returns 502 without leaking upstream details when PostHog is unavailable", async () => {
    installSupabaseFetch();
    mocks.loadAnalytics.mockRejectedValue(new Error("secret upstream response"));
    const response = await GET(request(), { params: { id: editionId } });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: "Statistics are temporarily unavailable." });
  });
});
