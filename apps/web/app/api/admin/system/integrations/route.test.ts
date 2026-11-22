import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({ gate: vi.fn() }));

vi.mock("../../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../../lib/video-render-api")>("../../../../../lib/video-render-api");
  return { ...actual, authorizeVideoAdmin: mocks.gate };
});

const supabase = { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service-key" };
const request = () => new Request("http://localhost/api/admin/system/integrations", { headers: { authorization: "Bearer admin" } });

describe("GET /api/admin/system/integrations", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_live_TOP_SECRET";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_TOP_SECRET";
    process.env.RESEND_API_KEY = "re_TOP_SECRET";
    process.env.ANTHROPIC_API_KEY = "sk-ant-TOP_SECRET";
    delete process.env.OPENAI_API_KEY;
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: "admin-user", supabase } });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/transactional_email_log?")) return Response.json([]);
      if (url.includes("/video_render_jobs?")) return Response.json([]);
      if (url.includes("/carousel_render_jobs?")) return Response.json([]);
      if (url.includes("/runner_billing_events?")) return Response.json([]);
      if (url.includes("/organizer_edition_payments?")) return Response.json([]);
      if (url.includes("/flyover_video_orders?")) return Response.json([]);
      return Response.json({ message: `Unhandled ${url}` }, { status: 500 });
    }));
  });

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects a caller who is not an admin", async () => {
    mocks.gate.mockResolvedValue({ ok: false, response: NextResponse.json({ message: "Not authorized." }, { status: 403 }) });
    expect((await GET(request())).status).toBe(403);
  });

  it("says which variables are present without ever returning a value", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("TOP_SECRET");
    const body = JSON.parse(text);
    const byKey = Object.fromEntries(body.services.map((service: { key: string }) => [service.key, service]));
    expect(byKey.stripe.checks[0]).toEqual({ label: "Clé secrète (STRIPE_SECRET_KEY)", present: true });
    expect(byKey.anthropic.status).toBe("ok");
    expect(byKey.openai.status).toBe("off");
    expect(body.renders).toEqual([]);
    expect(body.emails).toMatchObject({ configured: true, journalAvailable: true, sent24h: 0 });
  });
});
