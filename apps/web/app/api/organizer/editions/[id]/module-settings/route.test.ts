import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "./route";

const editionId = "11111111-1111-4111-8111-111111111111";

describe("PATCH /api/organizer/editions/[id]/module-settings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json([{ id: editionId, event_id: "22222222-2222-4222-8222-222222222222", module_setup_completed_at: null }]))
      .mockResolvedValueOnce(Response.json([])));
  });
  afterEach(() => vi.restoreAllMocks());

  it("allows activation outside the current offer as a private draft", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    const response = await PATCH(new NextRequest("http://localhost", {
      method: "PATCH", body: JSON.stringify({ updates: [{ scope: "edition", moduleKey: "services", enabled: true }] }),
    }), { params: { id: editionId } });
    expect(response.status).toBe(200);
    const mutation = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(mutation?.[1]?.body))).toMatchObject({ module_key: "services", is_enabled: true });
  });

  it("allows disabling an unavailable module without deleting content", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    const response = await PATCH(new NextRequest("http://localhost", {
      method: "PATCH", body: JSON.stringify({ updates: [{ scope: "edition", moduleKey: "services", enabled: false }] }),
    }), { params: { id: editionId } });
    expect(response.status).toBe(200);
    const mutation = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(mutation?.[1]?.body))).toMatchObject({ module_key: "services", is_enabled: false });
  });
});

vi.mock("../../../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireOrganizerAuth: () => Promise.resolve({ user: { id: "33333333-3333-4333-8333-333333333333" }, serviceConfig: { supabaseUrl: "https://db.test", supabaseServiceRoleKey: "service" } }),
  requireEventOrganizer: () => Promise.resolve(true),
  serviceHeaders: () => ({ "Content-Type": "application/json" }),
  uuidParamSchema: { safeParse: (value: unknown) => ({ success: true, data: value as { id: string } }) },
}));
vi.mock("../../../../../../lib/organizer-entitlements", () => ({
  loadOrganizerEditionEntitlement: () => Promise.resolve({ tier: "essential", status: "active" }),
}));
vi.mock("../../../../../../lib/organizer-module-settings", () => ({
  loadOrganizerModuleSettings: () => Promise.resolve({
    edition: { equipment: true, bib_pickup: true, access: true, services: false, branding: false, sponsors: false }, races: {},
  }),
}));
