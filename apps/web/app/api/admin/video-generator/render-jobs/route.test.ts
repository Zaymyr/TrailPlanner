import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({ gate: vi.fn(), insertRenderJob: vi.fn(), listRenderJobs: vi.fn() }));

vi.mock("../../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../../lib/video-render-api")>("../../../../../lib/video-render-api");
  return { ...actual, authorizeRenderAdmin: mocks.gate };
});
vi.mock("../../../../../lib/video-render", async () => {
  const actual = await vi.importActual<typeof import("../../../../../lib/video-render")>("../../../../../lib/video-render");
  return {
    ...actual,
    insertRenderJob: mocks.insertRenderJob,
    listRenderJobs: mocks.listRenderJobs,
    getGoogleAccessToken: vi.fn().mockResolvedValue("google-token"),
    signStorageUrl: vi.fn().mockResolvedValue("https://storage.example/input"),
  };
});

const raceId = "33333333-3333-4333-8333-333333333333";
const content = {
  hook: "Prêt ?",
  script_segments: [{ highlight_id: "hl-intro", text: "Prêt ?" }],
  cta: "Lien en bio.",
  caption: "Description.",
  hashtags: ["trail"],
  cover_text: "Prêt ?",
};
const request = (body: unknown) => new Request("http://localhost/api/admin/video-generator/render-jobs", {
  method: "POST",
  headers: { authorization: "Bearer admin", "content-type": "application/json" },
  body: JSON.stringify(body),
});
const base = { raceId, raceTitle: "SaintéLyon", width: 1080, height: 1920 };

describe("POST /api/admin/video-generator/render-jobs", () => {
  beforeEach(() => {
    mocks.gate.mockReset();
    mocks.insertRenderJob.mockReset();
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: "admin", supabase: {}, config: {} } });
    mocks.insertRenderJob.mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444" });
  });

  it("stores the reel content of a highlights video with the job", async () => {
    const response = await POST(request({ ...base, content }));
    expect(response.status).toBe(201);
    expect(mocks.insertRenderJob.mock.calls[0][1]).toMatchObject({ race_id: raceId, status: "uploading", created_by: "admin", content });
  });

  it("creates a job without content for a full reel or an older editor", async () => {
    expect((await POST(request(base))).status).toBe(201);
    expect((await POST(request({ ...base, content: null }))).status).toBe(201);
    for (const call of mocks.insertRenderJob.mock.calls) expect(call[1]).not.toHaveProperty("content");
  });

  it("flags the job for an automatic draft only when it carries reel content", async () => {
    expect((await POST(request({ ...base, content, autoDraft: true }))).status).toBe(201);
    expect(mocks.insertRenderJob.mock.calls[0][1]).toMatchObject({ auto_draft: true, content });
    // No content: nothing to pre-fill, the flag is dropped. Absent or false: no flag.
    await POST(request({ ...base, autoDraft: true }));
    await POST(request({ ...base, content, autoDraft: false }));
    await POST(request({ ...base, content }));
    for (const call of mocks.insertRenderJob.mock.calls.slice(1)) expect(call[1]).not.toHaveProperty("auto_draft");
  });

  it("rejects a non-boolean autoDraft", async () => {
    expect((await POST(request({ ...base, content, autoDraft: "yes" }))).status).toBe(400);
    expect(mocks.insertRenderJob).not.toHaveBeenCalled();
  });

  it("rejects a content that does not fit the schema, before creating anything", async () => {
    expect((await POST(request({ ...base, content: { ...content, caption: "x".repeat(2_201) } }))).status).toBe(400);
    expect((await POST(request({ ...base, content: { hook: "seul" } }))).status).toBe(400);
    expect(mocks.insertRenderJob).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/video-generator/render-jobs", () => {
  const row = (id: string, status: string) => ({
    id, race_id: raceId, race_title: "SaintéLyon", status, progress: 1, message: null, width: 1080, height: 1920, output_size_bytes: 1_000,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), started_at: null, finished_at: new Date().toISOString(),
  });

  beforeEach(() => {
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: "admin", supabase: { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "key" }, config: {} } });
    mocks.listRenderJobs.mockResolvedValue([row("66666666-6666-4666-8666-666666666666", "running"), row("77777777-7777-4777-8777-777777777777", "failed")]);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("adds the race and the Instagram draft of each render, for the studio links", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ id: "post-1", video_job_id: "77777777-7777-4777-8777-777777777777", carousel_job_id: null, status: "draft", media_type: "reel" }])));
    const response = await GET(new Request("http://localhost/api/admin/video-generator/render-jobs", { headers: { authorization: "Bearer admin" } }));
    const { jobs } = await response.json() as { jobs: Array<{ id: string; raceId: string; post: { id: string; status: string } | null }> };
    expect(jobs.map((job) => [job.raceId, job.post])).toEqual([[raceId, null], [raceId, { id: "post-1", status: "draft" }]]);
  });

  it("still lists the renders when the draft lookup fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const response = await GET(new Request("http://localhost/api/admin/video-generator/render-jobs", { headers: { authorization: "Bearer admin" } }));
    expect(response.status).toBe(200);
    expect(((await response.json()) as { jobs: unknown[] }).jobs).toHaveLength(2);
  });
});
