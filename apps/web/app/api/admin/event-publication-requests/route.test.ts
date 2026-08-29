import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH } from "./route";

describe("/api/admin/event-publication-requests PATCH", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reviews publication through the atomic database function", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json({ id: "11111111-1111-1111-1111-111111111111", status: "approved" }));
    const request = new NextRequest("http://localhost/api/admin/event-publication-requests", {
      method: "PATCH",
      headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
      body: JSON.stringify({ requestId: "11111111-1111-1111-1111-111111111111", status: "approved" }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(200);
    const [url, init] = vi.mocked(fetch).mock.calls[1] ?? [];
    expect(String(url)).toContain("/rpc/review_race_event_publication_request");
    expect(JSON.parse(init?.body as string)).toMatchObject({
      p_status: "approved",
      p_reviewer_id: "00000000-0000-0000-0000-000000000099",
    });
  });

  it("publishes or hides Racebooks through the admin visibility function", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(2));
    const request = new NextRequest("http://localhost/api/admin/event-publication-requests", {
      method: "PATCH",
      headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
      body: JSON.stringify({
        action: "setRacebookVisibility",
        eventId: "22222222-2222-2222-2222-222222222222",
        isLive: true,
      }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(200);
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).toContain("/rpc/set_race_event_racebook_visibility");
    expect(JSON.parse(init?.body as string)).toMatchObject({
      p_event_id: "22222222-2222-2222-2222-222222222222",
      p_is_live: true,
    });
  });

  it("loads the pending requests and current-edition Racebook controls", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([
        {
          id: "77777777-7777-7777-7777-777777777777",
          created_at: "2026-08-20T12:00:00Z",
          user_id: "88888888-8888-8888-8888-888888888888",
          event_id: "22222222-2222-2222-2222-222222222222",
          race_id: "44444444-4444-4444-4444-444444444444",
          status: "pending",
          requested_race: { name: "42 km", race_date: "2026-08-20" },
        },
      ]))
      .mockResolvedValueOnce(Response.json([
        {
          id: "22222222-2222-2222-2222-222222222222",
          name: "Trail du Fort",
          race_event_editions: [{ id: "33333333-3333-3333-3333-333333333333", is_current: true }],
          races: [
            {
              id: "44444444-4444-4444-4444-444444444444",
              edition_id: "33333333-3333-3333-3333-333333333333",
              name: "42 km",
              racebook_is_live: false,
              racebook_publication_approved_at: null,
            },
            {
              id: "55555555-5555-5555-5555-555555555555",
              edition_id: "66666666-6666-6666-6666-666666666666",
              name: "Ancienne édition",
              racebook_is_live: true,
              racebook_publication_approved_at: "2026-01-01T00:00:00Z",
            },
          ],
        },
      ]))
      .mockResolvedValueOnce(Response.json([{
        edition_id: "33333333-3333-3333-3333-333333333333",
        tier: "racebook",
        source: "stripe",
        status: "active",
      }]))
      .mockResolvedValueOnce(Response.json([{
        edition_id: "33333333-3333-3333-3333-333333333333",
        status: "paid",
        amount_total: 11880,
        currency: "eur",
        created_at: "2026-08-20T12:00:00Z",
      }]));

    const response = await GET(new NextRequest("http://localhost/api/admin/event-publication-requests", {
      headers: { authorization: "Bearer admin-token" },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.events[0].races).toHaveLength(1);
    expect(payload.events[0].races[0].name).toBe("42 km");
    expect(payload.events[0].entitlement.tier).toBe("racebook");
    expect(payload.publicationRequests[0].requested_race.name).toBe("42 km");
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain("requested_race:races");
  });
});

vi.mock("../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireAdminAuth: () => Promise.resolve({
    user: { id: "00000000-0000-0000-0000-000000000099" },
    serviceConfig: { supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" },
  }),
  serviceHeaders: () => ({ apikey: "service-key", Authorization: "Bearer service-key", "Content-Type": "application/json" }),
}));
