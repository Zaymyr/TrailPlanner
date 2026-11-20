import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({ gate: vi.fn() }));

vi.mock("../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/video-render-api")>("../../../../lib/video-render-api");
  return { ...actual, authorizeVideoAdmin: mocks.gate };
});

const supabase = { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service-key" };
const request = () => new Request("http://localhost/api/admin/render-activity", { headers: { authorization: "Bearer admin" } });
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

describe("GET /api/admin/render-activity", () => {
  let patches: Array<{ url: string; body: Record<string, unknown> }>;

  beforeEach(() => {
    patches = [];
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: "admin-user", supabase } });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        patches.push({ url, body });
        return Response.json([{
          id: "66666666-6666-4666-8666-666666666666", series: "plan", race_id: null, title: "SaintéLyon 80 km", status: "failed", snapshot: {}, content: null, slide_count: 3, image_paths: [],
          message: body.message, auto_draft: false, created_by: null, created_at: minutesAgo(90), updated_at: minutesAgo(0), started_at: null, finished_at: body.finished_at,
        }]);
      }
      if (url.includes("/video_render_jobs?")) {
        return Response.json([
          { id: "reel-1", race_title: "Hivernale des Templiers", status: "running", progress: 0.42, message: null, created_at: minutesAgo(5), updated_at: minutesAgo(0), started_at: minutesAgo(4), finished_at: null },
          { id: "reel-old", race_title: "Vieux rendu", status: "done", progress: 1, message: null, created_at: minutesAgo(3_000), updated_at: minutesAgo(2_990), started_at: minutesAgo(2_999), finished_at: minutesAgo(2_990) },
        ]);
      }
      if (url.includes("/carousel_render_jobs?")) {
        expect(url).not.toContain("snapshot");
        return Response.json([
          { id: "car-1", series: "week", title: "Semaine du 23 nov.", status: "failed", slide_count: 2, message: "Polices et images : A network error occurred.", created_at: minutesAgo(30), started_at: minutesAgo(29), finished_at: minutesAgo(29) },
          { id: "car-lost", series: "plan", title: "SaintéLyon 80 km", status: "queued", slide_count: 3, message: null, created_at: minutesAgo(90), started_at: null, finished_at: null },
        ]);
      }
      return new Response("unexpected", { status: 500 });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("refuses a non-admin", async () => {
    mocks.gate.mockResolvedValue({ ok: false, response: NextResponse.json({ message: "Not authorized." }, { status: 403 }) });
    expect((await GET(request())).status).toBe(403);
  });

  it("lists recent renders with their stage, active first, and fails the lost ones", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const { jobs } = await response.json() as { jobs: Array<{ id: string; status: string; stage: string; progress: number | null }> };
    expect(jobs.map((job) => job.id)).toEqual(["reel-1", "car-1", "car-lost"]);
    expect(jobs[0]).toMatchObject({ status: "active", progress: 0.42, stage: "Rendu vidéo · 42 %" });
    expect(jobs[1].stage).toBe("Échec : Polices et images : A network error occurred.");
    expect(jobs[2]).toMatchObject({ status: "failed", stage: "Échec : Le rendu n’a plus donné de nouvelles : relance-le." });
    expect(patches).toHaveLength(1);
    expect(patches[0].url).toContain("carousel_render_jobs?id=eq.car-lost&status=in.(queued,running)");
  });
});
