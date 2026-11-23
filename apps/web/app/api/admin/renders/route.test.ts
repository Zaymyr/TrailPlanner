import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({ gate: vi.fn(), config: vi.fn(), sign: vi.fn(), token: vi.fn() }));

vi.mock("../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/video-render-api")>("../../../../lib/video-render-api");
  return { ...actual, authorizeVideoAdmin: mocks.gate };
});
vi.mock("../../../../lib/video-render", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/video-render")>("../../../../lib/video-render");
  return { ...actual, getVideoRenderConfig: mocks.config, signStorageUrl: mocks.sign, getGoogleAccessToken: mocks.token };
});

const supabase = { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service-key" };
const request = (search = "") => new Request(`http://localhost/api/admin/renders${search}`, { headers: { authorization: "Bearer admin" } });
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const videoRow = (patch: Record<string, unknown>) => ({
  race_title: "Hivernale des Templiers", status: "done", progress: 1, message: null, created_at: minutesAgo(60), updated_at: minutesAgo(50),
  started_at: minutesAgo(58), finished_at: minutesAgo(50), race_id: "race-1", flyover_order_id: null, width: 1080, height: 1920, output_size_bytes: 1_048_576, auto_draft: false, ...patch,
});

describe("GET /api/admin/renders", () => {
  let urls: string[];
  let patches: string[];

  beforeEach(() => {
    urls = [];
    patches = [];
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: "admin-user", supabase } });
    mocks.config.mockReturnValue(null);
    mocks.sign.mockReset().mockResolvedValue("https://storage.example/signed.mp4");
    mocks.token.mockReset().mockResolvedValue("google-token");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PATCH") {
        patches.push(url);
        return Response.json([{ ...videoRow({ id: "11111111-1111-4111-8111-111111111111", race_id: "55555555-5555-4555-8555-555555555555", status: "failed", message: "Le rendu n’a plus donné de nouvelles : relance-le." }), content: null, created_by: null }]);
      }
      urls.push(url);
      if (url.includes("/video_render_jobs?")) {
        if (url.includes("id=eq.")) return Response.json([]);
        return Response.json([
          videoRow({ id: "11111111-1111-4111-8111-111111111111", status: "running", progress: 0.5, finished_at: null, created_at: minutesAgo(120), updated_at: minutesAgo(40) }),
          videoRow({ id: "22222222-2222-4222-8222-222222222222", auto_draft: true }),
          videoRow({ id: "33333333-3333-4333-8333-333333333333", race_id: null, flyover_order_id: "order-1" }),
        ]);
      }
      if (url.includes("/carousel_render_jobs?")) {
        return Response.json([{ id: "44444444-4444-4444-8444-444444444444", series: "plan", title: "SaintéLyon", status: "done", slide_count: 3, message: null, created_at: minutesAgo(30), started_at: minutesAgo(29), finished_at: minutesAgo(28), race_id: null, auto_draft: true, created_by: null }]);
      }
      if (url.includes("/reel_automation_items?")) return Response.json([{ id: "item-1", render_job_id: "22222222-2222-4222-8222-222222222222", social_post_id: "post-1", planned_publish_date: "2026-12-05" }]);
      if (url.includes("/carousel_automation_items?")) return Response.json([]);
      if (url.includes("/social_posts?")) return Response.json([{ id: "post-1", video_job_id: "22222222-2222-4222-8222-222222222222", carousel_job_id: null, status: "draft", media_type: "reel", created_at: minutesAgo(49) }]);
      if (url.includes("/flyover_video_orders?")) return Response.json([{ id: "order-1", race_name: "Trail du Mont", status: "ready" }]);
      return new Response("unexpected", { status: 500 });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("refuses a non-admin", async () => {
    mocks.gate.mockResolvedValue({ ok: false, response: NextResponse.json({ message: "Not authorized." }, { status: 403 }) });
    expect((await GET(request())).status).toBe(403);
    expect(urls).toHaveLength(0);
  });

  it("merges every render with its type, status, origin and post, and fails the lost ones", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const body = await response.json() as { entries: Array<{ id: string; type: string; status: string; origin: { href: string } | null; post: { href: string } | null; downloadUrl: string | null }>; counts: { total: number }; activeCount: number; downloadsAvailable: boolean };
    // The silent render (running, no news for 40 min) is marked failed in the base and in the answer.
    expect(patches).toHaveLength(1);
    expect(patches[0]).toContain("video_render_jobs?id=eq.11111111-1111-4111-8111-111111111111&status=in.(uploading,queued,running)");
    const byType = Object.fromEntries(body.entries.map((entry) => [entry.type + entry.id.slice(0, 1), entry]));
    expect(body.entries.map((entry) => entry.type).sort()).toEqual(["auto", "carrousel", "manuel", "survol"]);
    expect(byType.manuel1.status).toBe("echec");
    expect(byType.auto2).toMatchObject({ status: "termine", origin: { href: "/admin/content/posts?element=item-1" }, post: { href: "/admin/content/posts?post=post-1" } });
    expect(byType.survol3.origin?.href).toBe("/admin/content/flyovers?commande=order-1");
    expect(body.counts.total).toBe(4);
    expect(body.activeCount).toBe(0);
    // Google Cloud is not configured: the list loads, without MP4 links.
    expect(body.downloadsAvailable).toBe(false);
    expect(body.entries.every((entry) => entry.downloadUrl === null)).toBe(true);
  });

  it("signs a 1-hour MP4 link for each finished reel when Google Cloud is configured", async () => {
    mocks.config.mockReturnValue({ bucket: "bucket" });
    const response = await GET(request("?type=auto,survol"));
    const body = await response.json() as { entries: Array<{ id: string; type: string; downloadUrl: string | null }>; downloadsAvailable: boolean };
    expect(body.entries.map((entry) => entry.type).sort()).toEqual(["auto", "survol"]);
    expect(body.entries.every((entry) => entry.downloadUrl === "https://storage.example/signed.mp4")).toBe(true);
    expect(body.downloadsAvailable).toBe(true);
    expect(mocks.sign).toHaveBeenCalledTimes(2);
    expect(mocks.sign.mock.calls[0][0]).toMatchObject({ method: "GET", expiresSeconds: 3_600, objectName: expect.stringMatching(/^jobs\/.+\/reel\.mp4$/) });
  });

  it("filters by status and reads the period from the query", async () => {
    const body = await (await GET(request("?statut=echec&periode=24h"))).json() as { entries: Array<{ id: string }>; total: number };
    expect(body.total).toBe(1);
    expect(urls.find((url) => url.includes("/video_render_jobs?"))).toContain("or=(created_at.gte.");
    const all = await GET(request("?periode=tout"));
    expect(all.status).toBe(200);
    expect(urls.filter((url) => url.includes("/video_render_jobs?")).at(-1)).not.toContain("or=(created_at");
  });

  it("answers 502 when a render table cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    expect((await GET(request())).status).toBe(502);
  });
});
