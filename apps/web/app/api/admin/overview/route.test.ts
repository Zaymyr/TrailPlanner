import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({ gate: vi.fn() }));

vi.mock("../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/video-render-api")>("../../../../lib/video-render-api");
  return { ...actual, authorizeVideoAdmin: mocks.gate };
});

const supabase = { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service-key" };
const request = (query = "") => new Request(`http://localhost/api/admin/overview${query}`, { headers: { authorization: "Bearer admin" } });
const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

const growth = (newAccounts: number) => ({
  overview: { newAccounts, activationEligibleAccounts: 4, activatedUsers: 2, activePlanUsers: 20, newPlans: 9, activePremiumUsers: 5, premium: {} },
  trend: [{ date: "2026-11-22", newAccounts, activationEligibleAccounts: 1, activatedUsers: 1, activePlanUsers: 3, newPlans: 2 }],
  organizers: {
    publishedRacebooks: 1,
    commercial: { paidTransactions: 1, grossRevenueMinor: 9_900, invalidatedTransactions: 0, invalidatedRevenueMinor: 0, netRevenueMinor: 9_900, currency: "eur" },
    funnel: [{ step: "Avec un RaceBook publié", count: 1, conversionFromPrevious: null }],
    followUps: [],
  },
});

type Handler = (url: string, init?: RequestInit) => Response | undefined;
let override: Handler | null = null;
let rpcBodies: Array<Record<string, string>> = [];

const routes: Array<[string, (url: string, init?: RequestInit) => Response]> = [
  ["rpc/get_admin_growth_metrics", (_url, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, string>;
    rpcBodies.push(body);
    return Response.json(growth(rpcBodies.length === 2 ? 4 : 10));
  }],
  ["flyover_video_orders?paid_at=", () => Response.json([{ amount_cents: 2_999, status: "ready", paid_at: inHours(-2) }])],
  ["flyover_video_orders?status=in.", () => Response.json([])],
  ["flyover_video_orders?select=", () => Response.json([])],
  ["reel_automation_settings", () => Response.json([{
    generation_enabled: true, auto_publish_enabled: false, max_per_week: 3, max_per_day: 1, lead_days: 3, publish_time: "18:00:00", updated_by: null, updated_at: inHours(-5),
    plan_carousel_enabled: true, brief_carousel_enabled: false, week_carousel_enabled: false,
  }])],
  ["reel_automation_items", () => Response.json([])],
  ["carousel_automation_items", () => Response.json([])],
  ["social_posts?status=eq.scheduled", () => Response.json([{ id: "11111111-1111-4111-8111-111111111111", media_type: "reel", carousel_series: null, scheduled_at: inHours(1), dry_run: true, races: { name: "Trail des Aiguilles" } }])],
  ["social_posts?status=eq.published", () => Response.json([])],
  ["social_posts?status=eq.failed", () => new Response("[]", { headers: { "content-range": "0-0/2" } })],
  ["race_event_organizers", () => Response.json([])],
  ["video_render_jobs?created_at=", () => Response.json([{ status: "failed", created_at: inHours(-3) }, { status: "done", created_at: inHours(-2) }])],
  ["carousel_render_jobs?created_at=", () => Response.json([])],
  ["video_render_jobs?select=", () => Response.json([])],
  ["carousel_render_jobs?select=", () => Response.json([])],
  ["organizer_edition_payments", () => Response.json([])],
  ["rpc/admin_cron_job_status", () => Response.json([
    { job_name: "reel-automation", schedule: "17 * * * *", active: true, last_start: inHours(-3.5), last_end: inHours(-3.5), last_status: "succeeded", last_message: "1 row", runs_24h: 20, failures_24h: 0 },
    { job_name: "social-posts-publish", schedule: "*/5 * * * *", active: true, last_start: inHours(-0.05), last_end: inHours(-0.05), last_status: "succeeded", last_message: "1 row", runs_24h: 288, failures_24h: 0 },
  ])],
  ["rpc/admin_pg_net_response_summary", () => Response.json([{ available: true, responses: 12, errors: 0, oldest_at: inHours(-6), last_error_at: null, last_error_status: null, last_error_message: null }])],
  ["transactional_email_log", () => Response.json([])],
  ["runner_billing_events", () => Response.json([])],
];

describe("GET /api/admin/overview", () => {
  beforeEach(() => {
    override = null;
    rpcBodies = [];
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: "admin-user", supabase } });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const custom = override?.(url, init);
      if (custom) return custom;
      const route = routes.find(([fragment]) => url.includes(fragment));
      return route ? route[1](url, init) : Response.json({ message: `Unhandled ${url}` }, { status: 500 });
    }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects a caller who is not an admin", async () => {
    mocks.gate.mockResolvedValue({ ok: false, response: NextResponse.json({ message: "Not authorized." }, { status: 403 }) });
    expect((await GET(request())).status).toBe(403);
  });

  it("aggregates the period, the previous period and every block", async () => {
    const response = await GET(request("?range=7d"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.range).toMatchObject({ key: "7d", days: 7 });
    // Current, previous and the 30-day activity: three calls with exclusive end dates.
    expect(rpcBodies).toHaveLength(3);
    expect(rpcBodies[0].p_start_date).toBe(body.range.start);
    expect(rpcBodies[1]).toMatchObject({ p_start_date: body.range.previousStart, p_timezone: "Europe/Paris" });
    expect(body.kpis.status).toBe("ok");
    expect(body.kpis.data.newAccounts).toMatchObject({ current: 10, previous: 4 });
    expect(body.kpis.data.netRevenue).toMatchObject({ current: 9_900 + 2_999, partial: false });
    expect(body.revenue.data.sources.find((source: { key: string }) => source.key === "runners")).toMatchObject({ tracked: false, amountMinor: null });
    expect(body.funnel.data.organizers[0].step).toBe("Avec un Livret coureur publié");
    expect(body.agenda.data.days[0].events[0]).toMatchObject({ kind: "reel", scheduled: true, title: "Trail des Aiguilles" });
    const systems = body.health.data.systems as Array<{ key: string; status: string }>;
    expect(systems.find((system) => system.key === "renders")?.status).toBe("warning");
    expect(systems.find((system) => system.key === "instagram")).toMatchObject({ status: "error" });
    // Lot 3: scheduled tasks, e-mails and payments are measured (no line is « untracked » any more).
    expect(systems.filter((system) => system.status === "untracked")).toEqual([]);
    expect(systems.find((system) => system.key === "crons")).toMatchObject({ status: "error", href: "/admin/system/automation" });
    expect(systems.find((system) => system.key === "emails")).toMatchObject({ status: "error" });
    expect(systems.find((system) => system.key === "payments")).toMatchObject({ status: "error" });
    expect(body.feed.status).toBe("ok");
  });

  it("reuses the current period for the activity curve on 30 days", async () => {
    await GET(request("?range=30d"));
    expect(rpcBodies).toHaveLength(2);
  });

  it("keeps the other blocks when one source fails", async () => {
    override = (url) => (url.includes("rpc/get_admin_growth_metrics") || url.includes("reel_automation_settings") ? new Response("", { status: 500 }) : undefined);
    const body = await (await GET(request())).json();
    expect(body.kpis).toMatchObject({ status: "error" });
    expect(body.activity.status).toBe("error");
    expect(body.funnel.status).toBe("error");
    // Revenue still shows the flyovers, the organizer line says it could not be read.
    expect(body.revenue.status).toBe("ok");
    expect(body.revenue.data.sources.find((source: { key: string }) => source.key === "organizers").amountMinor).toBeNull();
    expect(body.agenda.status).toBe("ok");
    expect(body.health.data.systems.find((system: { key: string }) => system.key === "automation").status).toBe("unknown");
    expect(body.health.data.systems.find((system: { key: string }) => system.key === "renders").status).toBe("warning");
  });
});
