import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const editionId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const raceId = "33333333-3333-4333-8333-333333333333";

const mocks = vi.hoisted(() => ({
  requireEventOrganizer: vi.fn(),
}));

vi.mock("../../../../../../lib/http", () => ({
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireEventOrganizer: mocks.requireEventOrganizer,
  requireOrganizerAuth: () => Promise.resolve({
    user: { id: "44444444-4444-4444-8444-444444444444" },
    serviceConfig: { supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service" },
  }),
  serviceHeaders: () => ({}),
  uuidParamSchema: {
    safeParse: (params: { id?: string }) => params.id
      ? { success: true, data: { id: params.id } }
      : { success: false },
  },
}));

vi.mock("../../../../../../lib/organizer-entitlements", () => ({
  loadOrganizerEditionEntitlement: () => Promise.resolve({ tier: "essential", status: "active" }),
}));

vi.mock("../../../../../../lib/organizer-publication", () => ({
  validateOrganizerEditionPublication: () => Promise.resolve({ ok: true, publishableRaceCount: 1, raceId: null }),
}));

describe("POST /api/organizer/editions/[id]/publication", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    mocks.requireEventOrganizer.mockResolvedValue(true);
  });

  afterEach(() => vi.restoreAllMocks());

  it("publishes only the formats selected for the private preview", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{ id: editionId, event_id: eventId }]))
      .mockResolvedValueOnce(Response.json([{
        id: raceId,
        racebook_is_live: true,
        racebook_preview_is_visible: true,
      }]));

    const response = await POST(new NextRequest("http://localhost", { method: "POST" }), {
      params: { id: editionId },
    });
    const payload = await response.json();
    const rpcCall = vi.mocked(fetch).mock.calls[1];

    expect(response.status).toBe(200);
    expect(payload).toEqual({ publishedRaceIds: [raceId] });
    expect(String(rpcCall?.[0])).toContain("/rpc/publish_organizer_edition_racebooks");
    expect(JSON.parse(String(rpcCall?.[1]?.body))).toMatchObject({ p_edition_id: editionId });
  });

  it("refuses publication when every format is hidden from the demo", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([{ id: editionId, event_id: eventId }]))
      .mockResolvedValueOnce(Response.json([]));

    const response = await POST(new NextRequest("http://localhost", { method: "POST" }), {
      params: { id: editionId },
    });

    expect(response.status).toBe(409);
  });
});
