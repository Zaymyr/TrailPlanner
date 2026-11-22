import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const authMock = vi.hoisted(() => ({ requireAdminAuth: vi.fn() }));
vi.mock("../../../../lib/organizer", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/organizer")>("../../../../lib/organizer");
  return { ...actual, requireAdminAuth: authMock.requireAdminAuth };
});

const healthMocks = vi.hoisted(() => ({ loadSystemHealth: vi.fn() }));
vi.mock("../../../../lib/admin-system-health-server", () => ({ loadSystemHealth: healthMocks.loadSystemHealth }));
const systemIncident = { id: "system:cron:reel-automation", type: "system", title: "Tâche planifiée en retard · Reels automatiques", context: "Système · en retard", since: new Date(Date.now() - 3 * 3_600_000).toISOString(), dueDate: null, href: "/admin/system/automation" };

const request = () => new NextRequest("http://localhost/api/admin/inbox-counts", { headers: { authorization: "Bearer admin" } });
const countResponse = (count: number) => new Response("[]", { status: 200, headers: { "content-range": `0-0/${count}` } });

describe("GET /api/admin/inbox-counts", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    healthMocks.loadSystemHealth.mockResolvedValue({ incidents: [systemIncident] });
    authMock.requireAdminAuth.mockResolvedValue({
      user: { id: "admin" },
      serviceConfig: { supabaseUrl: "https://example.supabase.co", supabaseServiceRoleKey: "service" },
    });
  });

  it("rejects non-admin callers", async () => {
    authMock.requireAdminAuth.mockResolvedValue({ error: new Response(null, { status: 403 }) });
    expect((await GET(request())).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("counts each pending queue separately and keeps the merged total", async () => {
    const counts: Record<string, number> = {
      "app_feedback?kind=eq.bug": 2,
      "app_feedback?kind=eq.feedback": 3,
      "race_requests?": 4,
      "organizer_demo_requests?": 5,
      "race_event_claims?": 6,
      "race_event_publication_requests?": 7,
      "race_event_edition_requests?": 8,
      "flyover_video_orders?status=eq.failed": 1,
      "social_posts?status=eq.failed": 2,
      "social_posts?status=eq.draft": 3,
    };
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/video_render_jobs?")) {
        return Response.json([{ id: "r1", race_title: "Orchis", status: "failed", progress: 0, message: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), started_at: null, finished_at: new Date().toISOString() }]);
      }
      if (url.includes("/carousel_render_jobs?")) return Response.json([]);
      const key = Object.keys(counts).find((candidate) => url.includes(`/rest/v1/${candidate}`));
      return key ? countResponse(counts[key]) : new Response("", { status: 500 });
    });

    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      bug: 2,
      feedback: 3,
      raceRequests: 4,
      demoRequests: 5,
      raceRequestsAndDemos: 9,
      organizerClaims: 6,
      publicationRequests: 7,
      editionRequests: 8,
      organizerTotal: 21,
      failedFlyovers: 1,
      failedPosts: 2,
      draftPosts: 3,
      failedRenders: 1,
      systemIncidents: 1,
      systemTotal: 8,
    });
    const queueCalls = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => /app_feedback|race_requests|organizer_demo|race_event_/.test(url));
    expect(queueCalls).toHaveLength(7);
    expect(queueCalls.every((url) => url.includes("status=eq.pending"))).toBe(true);
  });

  it("leaves a system count out (null) instead of failing every badge", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes("social_posts") || String(url).includes("render_jobs") ? new Response("", { status: 500 }) : countResponse(1)
    );
    healthMocks.loadSystemHealth.mockRejectedValue(new Error("rpc down"));
    const body = await (await GET(request())).json();
    expect(body).toMatchObject({ bug: 1, failedFlyovers: 1, failedPosts: null, draftPosts: null, failedRenders: null, systemIncidents: null, systemTotal: 1 });
  });

  it("treats a missing demo table as zero but fails on other errors", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes("organizer_demo_requests") ? new Response("", { status: 404 }) : countResponse(1)
    );
    const ok = await (await GET(request())).json();
    expect(ok.demoRequests).toBe(0);

    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes("race_event_claims") ? new Response("", { status: 500 }) : countResponse(1)
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await GET(request())).status).toBe(502);
  });
});
