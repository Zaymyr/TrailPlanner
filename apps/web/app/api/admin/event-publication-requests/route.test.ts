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

  it("rejects the retired admin Racebook visibility action", async () => {
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
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("grants a complimentary Essential tier through the audited admin function", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([{ tier: "essential", source: "complimentary" }]));
    const request = new NextRequest("http://localhost/api/admin/event-publication-requests", {
      method: "PATCH",
      headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
      body: JSON.stringify({
        action: "setEditionTier",
        editionId: "33333333-3333-3333-3333-333333333333",
        tier: "essential",
      }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(200);
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).toContain("/rpc/set_admin_organizer_edition_grant");
    expect(JSON.parse(init?.body as string)).toMatchObject({
      p_edition_id: "33333333-3333-3333-3333-333333333333",
      p_admin_id: "00000000-0000-0000-0000-000000000099",
      p_tier: "essential",
      p_origin: "complimentary",
    });
  });

  it("grants a complimentary Signature tier through the same audited admin function", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([{ tier: "signature", source: "complimentary" }]));
    const request = new NextRequest("http://localhost/api/admin/event-publication-requests", {
      method: "PATCH",
      headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
      body: JSON.stringify({
        action: "setEditionTier",
        editionId: "33333333-3333-3333-3333-333333333333",
        tier: "signature",
      }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(200);
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(JSON.parse(init?.body as string)).toMatchObject({
      p_edition_id: "33333333-3333-3333-3333-333333333333",
      p_admin_id: "00000000-0000-0000-0000-000000000099",
      p_tier: "signature",
      p_origin: "complimentary",
    });
  });

  it("records an offered publication origin through the guarded grant function", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([{ tier: "essential", source: "complimentary" }]));
    const request = new NextRequest("http://localhost/api/admin/event-publication-requests", {
      method: "PATCH",
      headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
      body: JSON.stringify({
        action: "setEditionGrant",
        editionId: "33333333-3333-3333-3333-333333333333",
        tier: "essential",
        origin: "complimentary",
      }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(200);
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).toContain("/rpc/set_admin_organizer_edition_grant");
    expect(JSON.parse(init?.body as string)).toMatchObject({
      p_edition_id: "33333333-3333-3333-3333-333333333333",
      p_admin_id: "00000000-0000-0000-0000-000000000099",
      p_tier: "essential",
      p_origin: "complimentary",
    });
  });

  it("returns a clear conflict when no matching paid transaction exists", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("No matching paid organizer transaction exists", { status: 400 }));
    const request = new NextRequest("http://localhost/api/admin/event-publication-requests", {
      method: "PATCH",
      headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
      body: JSON.stringify({
        action: "setEditionGrant",
        editionId: "33333333-3333-3333-3333-333333333333",
        tier: "essential",
        origin: "stripe",
      }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      message: "Aucun paiement valide ne correspond à ce pack et à cette origine.",
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
        tier: "complete",
        source: "stripe",
        status: "active",
      }]))
      .mockResolvedValueOnce(Response.json([{
        id: "99999999-9999-4999-8999-999999999999",
        edition_id: "33333333-3333-3333-3333-333333333333",
        to_tier: "complete",
        status: "paid",
        payment_channel: "stripe",
        amount_total: 11880,
        currency: "eur",
        paid_at: "2026-08-20T12:00:00Z",
        created_at: "2026-08-20T12:00:00Z",
      }]));

    const response = await GET(new NextRequest("http://localhost/api/admin/event-publication-requests", {
      headers: { authorization: "Bearer admin-token" },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.events[0].races).toHaveLength(1);
    expect(payload.events[0].races[0].name).toBe("42 km");
    expect(payload.events[0].entitlement.tier).toBe("complete");
    expect(payload.events[0].payments[0].payment_channel).toBe("stripe");
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
