import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "./route";

describe("/api/admin/event-publication-requests PATCH", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reviews publication through the atomic database function", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ id: "11111111-1111-1111-1111-111111111111", status: "approved" }));
    const request = new NextRequest("http://localhost/api/admin/event-publication-requests", {
      method: "PATCH",
      headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
      body: JSON.stringify({ requestId: "11111111-1111-1111-1111-111111111111", status: "approved" }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(200);
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).toContain("/rpc/review_race_event_publication_request");
    expect(JSON.parse(init?.body as string)).toMatchObject({
      p_status: "approved",
      p_reviewer_id: "00000000-0000-0000-0000-000000000099",
    });
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
