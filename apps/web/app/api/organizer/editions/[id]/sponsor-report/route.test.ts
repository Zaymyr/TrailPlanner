import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  requireOrganizerAuth: vi.fn(),
  requireEventOrganizer: vi.fn(),
  loadEntitlement: vi.fn(),
  loadGrants: vi.fn(),
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
vi.mock("../../../../../../lib/organizer-entitlements", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../lib/organizer-entitlements")>();
  return {
    ...actual,
    loadOrganizerEditionEntitlement: mocks.loadEntitlement,
    loadOrganizerEditionCapabilityGrants: mocks.loadGrants,
  };
});
vi.mock("../../../../../../lib/posthog-organizer-analytics", () => ({
  loadPostHogOrganizerAnalytics: mocks.loadAnalytics,
}));

const editionId = "22222222-2222-4222-8222-222222222222";
const eventId = "11111111-1111-4111-8111-111111111111";
const raceId = "33333333-3333-4333-8333-333333333333";
const sponsorId = "44444444-4444-4444-8444-444444444444";

const request = (query = "") => new NextRequest(
  `http://localhost/api/organizer/editions/${editionId}/sponsor-report${query}`,
  { headers: { authorization: "Bearer user-token" } },
);

const installSupabaseFetch = (options: { editionMissing?: boolean } = {}) => vi
  .spyOn(global, "fetch")
  .mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/race_event_editions?")) return Response.json(options.editionMissing ? [] : [{
      id: editionId,
      event_id: eventId,
      edition_year: 2026,
      start_date: "2026-09-12",
      end_date: "2026-09-13",
      race_events: { name: "Trail TST" },
    }]);
    if (url.includes("/race_event_edition_sponsors?")) return Response.json([{
      id: sponsorId,
      edition_id: editionId,
      name: "Sponsor A",
      logo_url: "https://cdn.example/a.png",
      website_url: "https://a.example",
      is_active: true,
      show_on_loading: true,
      show_in_banner: true,
      position: 0,
      click_count: 3,
      impression_count: 60,
      partnership_level: "principal",
      category: null,
      contextual_placement: "none",
      created_at: "2026-08-30T04:20:01Z",
    }]);
    if (url.includes("/race_event_edition_partner_slots?")) return Response.json([]);
    if (url.includes("/races?")) return Response.json([{ id: raceId }]);
    if (url.includes("/racebook_publications?")) return Response.json([{ published_at: "2026-08-27T09:40:34Z" }]);
    throw new Error(`Unexpected fetch: ${url}`);
  });

describe("GET organizer edition sponsor report", () => {
  beforeEach(() => {
    mocks.requireOrganizerAuth.mockResolvedValue({
      user: { id: "user-1", appMetadata: { role: "user" } },
      serviceConfig: { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service" },
    });
    mocks.requireEventOrganizer.mockResolvedValue(true);
    mocks.loadEntitlement.mockResolvedValue({ tier: "signature", status: "active" });
    mocks.loadGrants.mockResolvedValue({});
    mocks.loadAnalytics.mockResolvedValue({
      summary: { uniqueReaders: 12, totalOpens: 20, averageActiveSeconds: 75, engagementRate: 0.6 },
      daily: [],
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

  it("rejects an invalid format before authentication", async () => {
    const response = await GET(request("?format=xlsx"), { params: { id: editionId } });
    expect(response.status).toBe(400);
    expect(mocks.requireOrganizerAuth).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown edition", async () => {
    installSupabaseFetch({ editionMissing: true });
    const response = await GET(request(), { params: { id: editionId } });
    expect(response.status).toBe(404);
  });

  it("rejects non-members before loading entitlements or counters", async () => {
    const fetchMock = installSupabaseFetch();
    mocks.requireEventOrganizer.mockResolvedValue({ error: NextResponse.json({ message: "Not authorized for this event." }, { status: 403 }) });
    const response = await GET(request(), { params: { id: editionId } });
    expect(response.status).toBe(403);
    expect(mocks.loadEntitlement).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("race_event_edition_sponsors"))).toBe(false);
  });

  it.each(["visibility", "essential", "complete"] as const)("locks the report for the %s tier", async (tier) => {
    const fetchMock = installSupabaseFetch();
    mocks.loadEntitlement.mockResolvedValue({ tier, status: "active" });
    const response = await GET(request(), { params: { id: editionId } });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "Le rapport partenaires est inclus dans l’offre Signature." });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("race_event_edition_sponsors"))).toBe(false);
    expect(mocks.loadAnalytics).not.toHaveBeenCalled();
  });

  it("locks a revoked Signature entitlement", async () => {
    installSupabaseFetch();
    mocks.loadEntitlement.mockResolvedValue({ tier: "signature", status: "revoked" });
    const response = await GET(request(), { params: { id: editionId } });
    expect(response.status).toBe(403);
  });

  it("returns the aggregated report for Signature", async () => {
    installSupabaseFetch();
    const response = await GET(request(), { params: { id: editionId } });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const { report } = await response.json();
    expect(report).toMatchObject({
      title: "Rapport partenaires — Trail TST 2026",
      formatCount: 1,
      readers: { status: "available", uniqueReaders: 12, totalOpens: 20 },
      totals: { impressions: 60, clicks: 3, clickThroughRate: 0.05 },
      campaign: { from: "2026-08-27" },
    });
    expect(JSON.stringify(report)).not.toContain("a.example");
    expect(mocks.loadAnalytics).toHaveBeenCalledWith(expect.objectContaining({
      eventId,
      editionId,
      raceIds: [raceId],
      selectedRaceId: null,
      dateFrom: "2026-08-27",
    }));
  });

  it("serves the report with a sponsors gift but omits readers without the analytics capability", async () => {
    installSupabaseFetch();
    mocks.loadEntitlement.mockResolvedValue({ tier: "essential", status: "active" });
    mocks.loadGrants.mockResolvedValue({ [editionId]: [{ capabilityKey: "module.sponsors", status: "active" }] });
    const response = await GET(request(), { params: { id: editionId } });
    expect(response.status).toBe(200);
    expect((await response.json()).report.readers).toEqual({ status: "not_included" });
    expect(mocks.loadAnalytics).not.toHaveBeenCalled();
  });

  it("still ships sponsor counters when PostHog is unavailable", async () => {
    installSupabaseFetch();
    mocks.loadAnalytics.mockRejectedValue(new Error("upstream secret"));
    const response = await GET(request(), { params: { id: editionId } });
    expect(response.status).toBe(200);
    const { report } = await response.json();
    expect(report.readers).toEqual({ status: "unavailable" });
    expect(report.totals.impressions).toBe(60);
  });

  it("downloads CSV and PDF attachments", async () => {
    installSupabaseFetch();
    const csv = await GET(request("?format=csv"), { params: { id: editionId } });
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(csv.headers.get("content-disposition")).toBe('attachment; filename="rapport-partenaires-trail-tst-2026.csv"');
    expect(await csv.text()).toContain("Sponsor A;Principal;;Actif;");

    const pdf = await GET(request("?format=pdf"), { params: { id: editionId } });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});
