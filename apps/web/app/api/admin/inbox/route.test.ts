import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({ gate: vi.fn() }));

vi.mock("../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/video-render-api")>("../../../../lib/video-render-api");
  return { ...actual, authorizeVideoAdmin: mocks.gate };
});

const healthMocks = vi.hoisted(() => ({ loadSystemHealth: vi.fn() }));
vi.mock("../../../../lib/admin-system-health-server", () => ({ loadSystemHealth: healthMocks.loadSystemHealth }));
const systemIncident = { id: "system:cron:reel-automation", type: "system", title: "Tâche planifiée en retard · Reels automatiques", context: "Système · en retard", since: new Date(Date.now() - 2.5 * 3_600_000).toISOString(), dueDate: null, href: "/admin/system/automation" };

const supabase = { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service-key" };
const request = () => new Request("http://localhost/api/admin/inbox", { headers: { authorization: "Bearer admin" } });
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const uuid = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;

const flyover = {
  id: uuid("1"), offer: "download", amount_cents: 5_999, status: "failed", race_name: "SaintéLyon", race_date: null, contact_email: "a@b.fr", instagram_handle: null,
  map_preset: "signature", story_mode: null, terrain_exaggeration: 1.5, publish_local: null, aid_stations: [], gpx_storage_path: "flyover/x.gpx", distance_km: 80,
  elevation_gain_m: null, elevation_loss_m: null, stripe_checkout_session_id: null, stripe_checkout_url: null, stripe_payment_intent_id: null, paid_at: hoursAgo(10),
  work: null, attempts: 3, error: "arrêtée à la main", locked_until: null, render_job_id: null, social_post_id: null, ready_at: null, paid_email_sent_at: null,
  ready_email_sent_at: null, created_at: hoursAgo(11), updated_at: hoursAgo(2),
};

let failing: string | null = null;

describe("GET /api/admin/inbox", () => {
  beforeEach(() => {
    failing = null;
    healthMocks.loadSystemHealth.mockResolvedValue({ incidents: [systemIncident] });
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: "admin-user", supabase } });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (failing && url.includes(failing)) return new Response("", { status: 500 });
      if (url.includes("/app_feedback?")) {
        expect(url).toContain("status=eq.pending");
        return Response.json([{ id: 7, created_at: hoursAgo(30), kind: "bug", subject: "[bug] PDF", source: "ios", screen: null }]);
      }
      if (url.includes("/race_requests?")) return Response.json([]);
      if (url.includes("/organizer_demo_requests?")) return new Response("", { status: 404 });
      if (url.includes("/race_event_claims?")) return Response.json([{ id: "claim-1", created_at: hoursAgo(50), organization_name: "Club", contact_email: "c@club.fr", race_events: { name: "Ultra des Druides" } }]);
      if (url.includes("/race_event_publication_requests?")) return Response.json([]);
      if (url.includes("/race_event_edition_requests?")) return Response.json([]);
      if (url.includes("/flyover_video_orders?")) return Response.json([flyover]);
      if (url.includes("/social_posts?")) return Response.json([{ id: "post-1", status: "draft", media_type: "reel", carousel_series: null, error: null, auto_generated: true, dry_run: true, created_at: hoursAgo(5), updated_at: hoursAgo(5), races: { name: "Orchis" } }]);
      if (url.includes("/video_render_jobs?")) return Response.json([{ id: "job-1", race_title: "Orchis", status: "failed", progress: 0, message: "GPU", created_at: hoursAgo(4), updated_at: hoursAgo(3), started_at: hoursAgo(4), finished_at: hoursAgo(3) }]);
      if (url.includes("/carousel_render_jobs?")) return Response.json([]);
      if (url.includes("/races?")) return Response.json([]);
      if (url.includes("/reel_automation_settings?")) return Response.json([]);
      return Response.json({ message: `Unhandled ${url}` }, { status: 500 });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects a caller who is not an admin", async () => {
    mocks.gate.mockResolvedValue({ ok: false, response: NextResponse.json({ message: "Not authorized." }, { status: 403 }) });
    expect((await GET(request())).status).toBe(403);
  });

  it("returns every pending item oldest first with the screen that handles it", async () => {
    const body = await (await GET(request())).json();
    expect(body.items.map((item: { type: string }) => item.type)).toEqual(["organizer_claim", "bug", "post_draft", "render_failed", "system", "flyover_failed"]);
    expect(body.items.find((item: { type: string }) => item.type === "system").href).toBe("/admin/system/automation");
    expect(body.items.find((item: { type: string }) => item.type === "flyover_failed").href).toBe("/admin/content/flyovers");
    expect(body.sources.every((source: { ok: boolean }) => source.ok)).toBe(true);
  });

  it("reports a failing source and still returns the others", async () => {
    failing = "/race_event_claims?";
    const body = await (await GET(request())).json();
    expect(body.items.some((item: { type: string }) => item.type === "organizer_claim")).toBe(false);
    expect(body.items.some((item: { type: string }) => item.type === "bug")).toBe(true);
    expect(body.sources.find((source: { key: string }) => source.key === "claims")).toMatchObject({ ok: false, message: "Demandes d’accès : lecture impossible." });
  });
});
