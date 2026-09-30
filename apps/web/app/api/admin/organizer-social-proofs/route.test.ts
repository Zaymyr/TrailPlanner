import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadPostHogOrganizerAnalytics } from "../../../../lib/posthog-organizer-analytics";
import { GET, PUT } from "./route";

const adminId = "99999999-9999-4999-8999-999999999999";
const editionId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const raceId = "33333333-3333-4333-8333-333333333333";
const proofId = "44444444-4444-4444-8444-444444444444";

const editionRow = {
  id: editionId,
  event_id: eventId,
  edition_year: 2026,
  start_date: "2026-09-13",
  end_date: "2026-09-13",
  race_events: { name: "Trail des Sommets", location: "Annecy", thumbnail_url: null },
};

const savedProofRow = {
  id: proofId,
  edition_id: editionId,
  status: "published",
  display_order: 0,
  quote_text: "Nos coureurs ont trouvé les informations facilement.",
  quote_author_name: "Camille Martin",
  quote_author_role: "Direction de course",
  consent_confirmed_at: "2026-09-30T12:00:00.000Z",
  unique_readers: 842,
  total_opens: 2310,
  analytics_from: "2026-08-01",
  analytics_to: "2026-09-27",
  analytics_captured_at: "2026-09-30T12:00:00.000Z",
  published_at: "2026-09-30T12:00:00.000Z",
  created_by: adminId,
  updated_at: "2026-09-30T12:00:00.000Z",
};

const request = (body: Record<string, unknown>) => new NextRequest("http://localhost/api/admin/organizer-social-proofs", {
  method: "PUT",
  headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("/api/admin/organizer-social-proofs", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(loadPostHogOrganizerAnalytics).mockResolvedValue({
      summary: { uniqueReaders: 842, totalOpens: 2310, averageActiveSeconds: 92, engagementRate: 0.63 },
      daily: [],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("loads editions and their curated proof snapshots", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([editionRow]))
      .mockResolvedValueOnce(Response.json([savedProofRow]));

    const response = await GET(new NextRequest("http://localhost/api/admin/organizer-social-proofs", {
      headers: { authorization: "Bearer admin-token" },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.editions[0]).toMatchObject({ id: editionId, eventName: "Trail des Sommets", editionYear: 2026 });
    expect(payload.proofs[0]).toMatchObject({ editionId, uniqueReaders: 842, totalOpens: 2310 });
  });

  it("captures the complete published window before publishing the proof", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([editionRow]))
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([{ id: raceId, racebook_publication_approved_at: "2026-08-01T09:30:00.000Z" }]))
      .mockResolvedValueOnce(Response.json([savedProofRow]));

    const response = await PUT(request({
      editionId,
      status: "published",
      displayOrder: 0,
      quoteText: "Nos coureurs ont trouvé les informations facilement.",
      quoteAuthorName: "Camille Martin",
      quoteAuthorRole: "Direction de course",
      consentConfirmed: true,
      refreshStats: true,
    }));

    expect(response.status).toBe(200);
    expect(loadPostHogOrganizerAnalytics).toHaveBeenCalledWith(expect.objectContaining({
      eventId,
      editionId,
      raceIds: [raceId],
      dateFrom: "2026-08-01",
      dateTo: "2026-09-27",
    }));
    const saveCall = vi.mocked(fetch).mock.calls[3];
    expect(String(saveCall?.[0])).toContain("organizer_social_proofs?on_conflict=edition_id");
    expect(JSON.parse(String(saveCall?.[1]?.body))).toMatchObject({
      status: "published",
      unique_readers: 842,
      total_opens: 2310,
      analytics_from: "2026-08-01",
      analytics_to: "2026-09-27",
      created_by: adminId,
      updated_by: adminId,
    });
  });

  it("requires publication consent before querying any private data", async () => {
    const response = await PUT(request({
      editionId,
      status: "published",
      displayOrder: 0,
      quoteText: null,
      quoteAuthorName: null,
      quoteAuthorRole: null,
      consentConfirmed: false,
      refreshStats: true,
    }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(loadPostHogOrganizerAnalytics).not.toHaveBeenCalled();
  });

  it("refuses to manufacture usage statistics for an unpublished RaceBook", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([editionRow]))
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([{ id: raceId, racebook_publication_approved_at: null }]));

    const response = await PUT(request({
      editionId,
      status: "published",
      displayOrder: 0,
      quoteText: null,
      quoteAuthorName: null,
      quoteAuthorRole: null,
      consentConfirmed: true,
      refreshStats: true,
    }));

    expect(response.status).toBe(409);
    expect(loadPostHogOrganizerAnalytics).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../lib/organizer", () => ({
  requireAdminAuth: () => Promise.resolve({
    user: { id: adminId },
    serviceConfig: { supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" },
  }),
  serviceHeaders: () => ({ apikey: "service-key", Authorization: "Bearer service-key", "Content-Type": "application/json" }),
}));
vi.mock("../../../../lib/posthog-organizer-analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/posthog-organizer-analytics")>();
  return { ...actual, loadPostHogOrganizerAnalytics: vi.fn() };
});

