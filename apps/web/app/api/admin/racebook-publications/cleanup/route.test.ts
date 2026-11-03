import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdminAuth: vi.fn() }));
vi.mock("../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => NextResponse.json({ message }, { status }),
  requireAdminAuth: mocks.requireAdminAuth,
  serviceHeaders: () => ({ "Content-Type": "application/json" }),
}));

import { POST } from "./route";

const config = { supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" };
const job = { id: "11111111-1111-4111-8111-111111111111", storage_bucket: "race-gpx", storage_path: "race/course.gpx", attempt_count: 0 };

beforeEach(() => mocks.requireAdminAuth.mockResolvedValue({ user: { id: "admin" }, serviceConfig: config }));
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("RaceBook publication asset cleanup", () => {
  it("never deletes an object that is referenced again", async () => {
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([job]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "22222222-2222-4222-8222-222222222222" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await POST(new NextRequest("http://localhost/api/admin/racebook-publications/cleanup", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ retained: [job.id], deleted: [] });
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes("/storage/v1/object/") && init?.method === "DELETE")).toBe(false);
  });

  it("deletes an unreferenced object and completes its job", async () => {
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([job]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await POST(new NextRequest("http://localhost/api/admin/racebook-publications/cleanup", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ deleted: [job.id], failed: [] });
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/storage/v1/object/race-gpx/race/course.gpx") && init?.method === "DELETE")).toBe(true);
  });
});
