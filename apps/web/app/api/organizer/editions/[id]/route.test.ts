import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, PATCH } from "./route";

const editionId = "11111111-1111-1111-1111-111111111111";
const eventId = "22222222-2222-2222-2222-222222222222";
const nextEditionId = "33333333-3333-3333-3333-333333333333";

const createRequest = (method: "PATCH" | "DELETE", body?: Record<string, unknown>) =>
  new NextRequest(`http://localhost/api/organizer/editions/${editionId}`, {
    method,
    headers: { authorization: "Bearer user-token", "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("/api/organizer/editions/[id]", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hides an edition through the membership-checked service route", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{ id: editionId, event_id: eventId, edition_year: 2025 }]))
      .mockResolvedValueOnce(Response.json([{
        id: editionId,
        event_id: eventId,
        edition_year: 2025,
        start_date: "2025-06-20",
        end_date: "2025-06-21",
        is_current: false,
        is_visible: false,
      }]));

    const response = await PATCH(createRequest("PATCH", { isVisible: false }), { params: { id: editionId } });
    const payload = await response!.json();

    expect(response!.status).toBe(200);
    expect(payload.edition.is_visible).toBe(false);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))).toEqual({ is_visible: false });
  });

  it("deletes the edition formats atomically and returns the replacement year", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{ id: editionId, event_id: eventId, edition_year: 2025 }]))
      .mockResolvedValueOnce(Response.json([{
        id: "44444444-4444-4444-4444-444444444444",
        gpx_storage_path: "organizer/event/race/source.gpx",
        thumbnail_url: "https://supabase.example/storage/v1/object/public/race-images/organizer/event/race.png",
      }]))
      .mockResolvedValueOnce(Response.json([{
        deleted_edition_id: editionId,
        next_edition_id: nextEditionId,
        next_edition_year: 2026,
      }]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const response = await DELETE(createRequest("DELETE"), { params: { id: editionId } });
    const payload = await response!.json();

    expect(response!.status).toBe(200);
    expect(payload).toMatchObject({ deletedEditionId: editionId, selectedEditionYear: 2026 });
    expect(String(vi.mocked(fetch).mock.calls[2]?.[0])).toContain("/rpc/delete_race_event_edition");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[2]?.[1]?.body))).toEqual({ p_edition_id: editionId });
    expect(String(vi.mocked(fetch).mock.calls[3]?.[0])).toContain("/race-gpx/");
    expect(String(vi.mocked(fetch).mock.calls[4]?.[0])).toContain("thumbnail_url=eq.");
    expect(String(vi.mocked(fetch).mock.calls[5]?.[0])).toContain("/race-images/");
  });

  it("refuses to delete the event's only edition", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{ id: editionId, event_id: eventId, edition_year: 2025 }]))
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json({ message: "The only edition cannot be deleted." }, { status: 400 }));

    const response = await DELETE(createRequest("DELETE"), { params: { id: editionId } });

    expect(response!.status).toBe(409);
    expect(await response!.json()).toMatchObject({ message: expect.stringContaining("seule édition") });
  });

  it("keeps a format image that is still referenced by another edition", async () => {
    const sharedImageUrl = "https://supabase.example/storage/v1/object/public/race-images/organizer/event/shared.png";
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{ id: editionId, event_id: eventId, edition_year: 2025 }]))
      .mockResolvedValueOnce(Response.json([{
        id: "44444444-4444-4444-4444-444444444444",
        gpx_storage_path: null,
        thumbnail_url: sharedImageUrl,
      }]))
      .mockResolvedValueOnce(Response.json([{
        deleted_edition_id: editionId,
        next_edition_id: nextEditionId,
        next_edition_year: 2026,
      }]))
      .mockResolvedValueOnce(Response.json([{ id: "55555555-5555-5555-5555-555555555555" }]));

    const response = await DELETE(createRequest("DELETE"), { params: { id: editionId } });

    expect(response!.status).toBe(200);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4);
    expect(String(vi.mocked(fetch).mock.calls[3]?.[0])).toContain(encodeURIComponent(sharedImageUrl));
  });
});

vi.mock("../../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireEventOrganizer: () => Promise.resolve(true),
  requireOrganizerAuth: () => Promise.resolve({
    user: { id: "00000000-0000-0000-0000-000000000001" },
    serviceConfig: { supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" },
  }),
  serviceHeaders: () => ({ apikey: "service-key", Authorization: "Bearer service-key" }),
  uuidParamSchema: {
    safeParse: (value: { id?: string }) => ({ success: Boolean(value.id), data: { id: value.id } }),
  },
}));
