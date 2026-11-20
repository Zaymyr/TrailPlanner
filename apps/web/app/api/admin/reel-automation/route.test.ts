import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_REEL_AUTOMATION_SETTINGS } from "../../../../lib/reel-automation";
import { GET, PATCH, POST } from "./route";
import { PATCH as PATCH_ITEM } from "./items/[id]/route";

const mocks = vi.hoisted(() => ({
  gate: vi.fn(),
  repository: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    listItems: vi.fn(),
    updateItem: vi.fn(),
  },
  deps: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/video-render-api")>("../../../../lib/video-render-api");
  return { ...actual, authorizeVideoAdmin: mocks.gate };
});
vi.mock("../../../../lib/reel-automation", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/reel-automation")>("../../../../lib/reel-automation");
  return { ...actual, createReelAutomationRepository: () => mocks.repository, refreshReelPlan: mocks.refresh };
});
vi.mock("../../../../lib/reel-generation", () => ({ createReelAutomationDeps: mocks.deps }));

const ITEM_ID = "55555555-5555-4555-8555-555555555555";
const supabase = { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service-key" };
const request = (method: string, body?: unknown) => new Request("http://localhost/api/admin/reel-automation", {
  method,
  headers: { authorization: "Bearer admin", "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe("admin reel automation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: "admin-user", supabase } });
    mocks.repository.getSettings.mockResolvedValue(DEFAULT_REEL_AUTOMATION_SETTINGS);
    mocks.repository.listItems.mockResolvedValue([]);
    mocks.repository.updateSettings.mockImplementation(async (patch) => ({ ...DEFAULT_REEL_AUTOMATION_SETTINGS, ...patch }));
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["GET", () => GET(request("GET"))],
    ["PATCH", () => PATCH(request("PATCH", { generationEnabled: true }))],
    ["POST", () => POST(request("POST", { action: "refresh" }))],
    ["PATCH item", () => PATCH_ITEM(request("PATCH", { action: "exclude" }), { params: { id: ITEM_ID } })],
  ])("rejects a non-admin on %s", async (_label, call) => {
    mocks.gate.mockResolvedValue({ ok: false, response: NextResponse.json({ message: "Not authorized." }, { status: 403 }) });
    expect((await call()).status).toBe(403);
    expect(mocks.repository.updateSettings).not.toHaveBeenCalled();
    expect(mocks.repository.updateItem).not.toHaveBeenCalled();
  });

  it("returns both switches off by default", async () => {
    const response = await GET(request("GET"));
    await expect(response.json()).resolves.toMatchObject({
      settings: { generationEnabled: false, autoPublishEnabled: false, maxPerWeek: 3, maxPerDay: 1, leadDays: 3, publishTime: "18:00" },
      items: [],
    });
  });

  it("turns generation on and records the admin", async () => {
    const response = await PATCH(request("PATCH", { generationEnabled: true }));
    expect(response.status).toBe(200);
    expect(mocks.repository.updateSettings).toHaveBeenCalledWith({ generation_enabled: true, auto_publish_enabled: false, updated_by: "admin-user" });
  });

  it("refuses automatic publication without the confirmation, or without generation", async () => {
    mocks.repository.getSettings.mockResolvedValue({ ...DEFAULT_REEL_AUTOMATION_SETTINGS, generation_enabled: true });
    expect((await PATCH(request("PATCH", { autoPublishEnabled: true }))).status).toBe(409);
    mocks.repository.getSettings.mockResolvedValue(DEFAULT_REEL_AUTOMATION_SETTINGS);
    expect((await PATCH(request("PATCH", { autoPublishEnabled: true, confirmAutoPublish: true }))).status).toBe(409);
    expect(mocks.repository.updateSettings).not.toHaveBeenCalled();
  });

  it("turns automatic publication on with the confirmation", async () => {
    mocks.repository.getSettings.mockResolvedValue({ ...DEFAULT_REEL_AUTOMATION_SETTINGS, generation_enabled: true });
    expect((await PATCH(request("PATCH", { autoPublishEnabled: true, confirmAutoPublish: true }))).status).toBe(200);
    expect(mocks.repository.updateSettings).toHaveBeenCalledWith(expect.objectContaining({ generation_enabled: true, auto_publish_enabled: true }));
  });

  it("turns automatic publication off with generation", async () => {
    mocks.repository.getSettings.mockResolvedValue({ ...DEFAULT_REEL_AUTOMATION_SETTINGS, generation_enabled: true, auto_publish_enabled: true });
    await PATCH(request("PATCH", { generationEnabled: false }));
    expect(mocks.repository.updateSettings).toHaveBeenCalledWith(expect.objectContaining({ generation_enabled: false, auto_publish_enabled: false }));
  });

  it("rejects unknown settings", async () => {
    expect((await PATCH(request("PATCH", { maxPerWeek: 10 }))).status).toBe(400);
  });

  it("recomputes the plan on demand", async () => {
    mocks.deps.mockReturnValue({ repository: mocks.repository });
    expect((await POST(request("POST", { action: "refresh" }))).status).toBe(200);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("excludes an item through a guarded update, and answers 409 when it is in progress", async () => {
    mocks.repository.updateItem.mockResolvedValueOnce({ id: ITEM_ID, status: "skipped", reason: "excluded" });
    const response = await PATCH_ITEM(request("PATCH", { action: "exclude" }), { params: { id: ITEM_ID } });
    expect(response.status).toBe(200);
    expect(mocks.repository.updateItem).toHaveBeenCalledWith(ITEM_ID, expect.objectContaining({ status: "skipped", reason: "excluded" }), expect.stringContaining("status.in.(planned,failed)"));
    mocks.repository.updateItem.mockResolvedValueOnce(null);
    expect((await PATCH_ITEM(request("PATCH", { action: "exclude" }), { params: { id: ITEM_ID } })).status).toBe(409);
  });

  it("restores an excluded item to the plan", async () => {
    mocks.repository.updateItem.mockResolvedValueOnce({ id: ITEM_ID, status: "planned", reason: null });
    await PATCH_ITEM(request("PATCH", { action: "include" }), { params: { id: ITEM_ID } });
    expect(mocks.repository.updateItem).toHaveBeenCalledWith(ITEM_ID, expect.objectContaining({ status: "planned", reason: null }), "status=eq.skipped&reason=eq.excluded");
  });
});
