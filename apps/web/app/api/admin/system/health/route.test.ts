import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({ gate: vi.fn() }));

vi.mock("../../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../../lib/video-render-api")>("../../../../../lib/video-render-api");
  return { ...actual, authorizeVideoAdmin: mocks.gate };
});

const supabase = { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service-key" };
const request = () => new Request("http://localhost/api/admin/system/health", { headers: { authorization: "Bearer admin" } });
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

let cronFails = false;

describe("GET /api/admin/system/health", () => {
  const env = { ...process.env };

  beforeEach(() => {
    cronFails = false;
    process.env.RESEND_API_KEY = "re_test";
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: "admin-user", supabase } });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/rpc/admin_cron_job_status")) {
        expect(init?.method).toBe("POST");
        if (cronFails) return new Response("", { status: 404 });
        return Response.json([
          { job_name: "flyover-orders", schedule: "*/10 * * * *", active: true, last_start: minutesAgo(4), last_end: minutesAgo(4), last_status: "failed", last_message: "boom", runs_24h: 144, failures_24h: 1 },
          { job_name: "demo-race-refresh", schedule: "5 * * * *", active: true, last_start: minutesAgo(20), last_end: minutesAgo(20), last_status: "succeeded", last_message: "1 row", runs_24h: 24, failures_24h: 0 },
        ]);
      }
      if (url.endsWith("/rpc/admin_pg_net_response_summary")) return Response.json([{ available: true, responses: 10, errors: 0, oldest_at: minutesAgo(300), last_error_at: null, last_error_status: null, last_error_message: null }]);
      if (url.includes("/transactional_email_log?")) return Response.json([{ id: "e1", created_at: minutesAgo(30), category: "flyover/paid", status: "sent", status_code: null, message: null, recipient_masked: "or***@trail.fr" }]);
      if (url.includes("/runner_billing_events?") && url.includes("processed_at.is.null")) return Response.json([]);
      if (url.includes("/runner_billing_events?")) return Response.json([{ received_at: minutesAgo(600) }]);
      if (url.includes("/organizer_edition_payments?")) return Response.json([]);
      if (url.includes("/flyover_video_orders?")) return Response.json([{ paid_at: minutesAgo(120) }]);
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

  it("returns the scheduled tasks, the Vercel crons and the three health lines", async () => {
    const body = await (await GET(request())).json();
    expect(body.tasks.map((task: { key: string; status: string }) => [task.key, task.status])).toEqual([["flyover-orders", "failed"], ["demo-race-refresh", "ok"]]);
    expect(body.vercelTasks.map((task: { status: string }) => task.status)).toEqual([]);
    expect(body.systems.map((system: { key: string; status: string }) => [system.key, system.status])).toEqual([["crons", "error"], ["emails", "ok"], ["payments", "ok"]]);
    expect(body.payments).toMatchObject({ lastEventSource: "commande de survol", unprocessed: [] });
    expect(body.emails.recent[0].recipient_masked).toBe("or***@trail.fr");
    // Internal fields of the loader stay server-side.
    expect(body.incidents).toBeUndefined();
  });

  it("answers with the other sources when the cron function is missing", async () => {
    cronFails = true;
    const body = await (await GET(request())).json();
    expect(body.tasks).toBeNull();
    expect(body.systems[0]).toMatchObject({ key: "crons", status: "unknown" });
    expect(body.systems[1].status).toBe("ok");
  });
});
