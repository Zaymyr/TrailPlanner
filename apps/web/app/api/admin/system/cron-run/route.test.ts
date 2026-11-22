import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gate: vi.fn(),
  rateLimit: vi.fn(),
  demo: vi.fn(),
  reel: vi.fn(),
}));

vi.mock("../../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../../lib/video-render-api")>("../../../../../lib/video-render-api");
  return { ...actual, authorizeVideoAdmin: mocks.gate };
});
vi.mock("../../../../../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../../../../../lib/http")>("../../../../../lib/http");
  return { ...actual, checkRateLimitAsync: mocks.rateLimit };
});
vi.mock("../../../cron/demo-race-refresh/route", () => ({ GET: mocks.demo }));
vi.mock("../../../cron/reel-automation/route", () => ({ GET: mocks.reel }));
vi.mock("../../../cron/carousel-automation/route", () => ({ GET: vi.fn() }));
vi.mock("../../../cron/flyover-orders/route", () => ({ GET: vi.fn() }));
vi.mock("../../../cron/organizer-import-cleanup/route", () => ({ GET: vi.fn() }));
vi.mock("../../../cron/social-posts-publish/route", () => ({ GET: vi.fn() }));

import { POST } from "./route";

const supabase = { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service-key" };
const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://pace-yourself.com/api/admin/system/cron-run", { method: "POST", headers: { authorization: "Bearer admin", "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

describe("POST /api/admin/system/cron-run", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: "admin-user", supabase } });
    mocks.rateLimit.mockResolvedValue({ allowed: true, remaining: 1 });
    mocks.demo.mockResolvedValue(Response.json({ ok: true, moved: false }));
    mocks.reel.mockResolvedValue(Response.json({ message: "Unable to run the reel automation." }, { status: 500 }));
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...env };
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("rejects a caller who is not an admin", async () => {
    mocks.gate.mockResolvedValue({ ok: false, response: NextResponse.json({ message: "Not authorized." }, { status: 403 }) });
    expect((await POST(request({ job: "demo-race-refresh" }))).status).toBe(403);
    expect(mocks.demo).not.toHaveBeenCalled();
  });

  it("only runs the allow-listed jobs", async () => {
    expect((await POST(request({ job: "push-reminders-daily" }))).status).toBe(400);
    expect((await POST(request({ job: "../../admin/users" }))).status).toBe(400);
  });

  it("refuses without CRON_SECRET and when the job was just run", async () => {
    delete process.env.CRON_SECRET;
    expect((await POST(request({ job: "demo-race-refresh" }))).status).toBe(503);
    process.env.CRON_SECRET = "cron-secret";
    mocks.rateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 30_000 });
    expect((await POST(request({ job: "demo-race-refresh" }))).status).toBe(429);
    expect(mocks.demo).not.toHaveBeenCalled();
  });

  it("invokes the cron handler in-process with the cron secret and returns its answer", async () => {
    const response = await POST(request({ job: "demo-race-refresh" }, { "x-vercel-oidc-token": "oidc" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ job: "demo-race-refresh", ok: true, status: 200, result: { ok: true, moved: false } });
    expect(JSON.stringify(body)).not.toContain("cron-secret");
    const cronRequest = mocks.demo.mock.calls[0][0] as Request;
    expect(cronRequest.url).toBe("https://pace-yourself.com/api/cron/demo-race-refresh");
    expect(cronRequest.headers.get("authorization")).toBe("Bearer cron-secret");
    expect(cronRequest.headers.get("x-vercel-oidc-token")).toBe("oidc");
    expect(mocks.rateLimit).toHaveBeenCalledWith("admin-cron-run:demo-race-refresh", 2, 60_000);
  });

  it("reports a failing run with the route status", async () => {
    const body = await (await POST(request({ job: "reel-automation" }))).json();
    expect(body).toMatchObject({ ok: false, status: 500, result: { message: "Unable to run the reel automation." } });
  });
});
