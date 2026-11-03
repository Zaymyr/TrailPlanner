import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({ requireAdminAuth: vi.fn(), publish: vi.fn() }));
vi.mock("../../../../../lib/organizer", () => ({
  requireAdminAuth: mocks.requireAdminAuth,
  serviceHeaders: () => ({}),
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
}));
vi.mock("../../../../../lib/racebook-publications", () => ({ publishRacebookSnapshot: mocks.publish }));

const request = new NextRequest("http://localhost/api/admin/racebook-publications/backfill", { method: "POST" });
const config = { supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" };

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("POST /api/admin/racebook-publications/backfill", () => {
  it("publishes only public formats that have no current snapshot", async () => {
    mocks.requireAdminAuth.mockResolvedValue({ user: { id: "99999999-9999-4999-8999-999999999999" }, serviceConfig: config });
    vi.spyOn(global, "fetch").mockResolvedValueOnce(Response.json([
      { id: "11111111-1111-4111-8111-111111111111" },
      { id: "22222222-2222-4222-8222-222222222222" },
    ]));
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledTimes(2);
    expect(await response.json()).toMatchObject({ candidateCount: 2, complete: true });
  });

  it("reports retryable per-format failures without replacing successful snapshots", async () => {
    mocks.requireAdminAuth.mockResolvedValue({ user: { id: "99999999-9999-4999-8999-999999999999" }, serviceConfig: config });
    vi.spyOn(global, "fetch").mockResolvedValueOnce(Response.json([{ id: "11111111-1111-4111-8111-111111111111" }]));
    mocks.publish.mockRejectedValue(new Error("invalid snapshot"));
    const response = await POST(request);
    expect(response.status).toBe(207);
    expect(await response.json()).toMatchObject({ complete: false, failures: [{ message: "invalid snapshot" }] });
  });
});
