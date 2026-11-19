import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  gate: vi.fn(),
  updateRenderJob: vi.fn(),
  createAutoDraft: vi.fn(),
}));

vi.mock("../../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../../lib/video-render-api")>("../../../../../lib/video-render-api");
  return { ...actual, authorizeRenderPage: mocks.gate };
});
vi.mock("../../../../../lib/video-render", async () => {
  const actual = await vi.importActual<typeof import("../../../../../lib/video-render")>("../../../../../lib/video-render");
  return {
    ...actual,
    updateRenderJob: mocks.updateRenderJob,
    getGoogleAccessToken: vi.fn().mockResolvedValue("google-token"),
    getStorageObjectSize: vi.fn().mockResolvedValue(1_234_567),
  };
});
vi.mock("../../../../../lib/social-post-auto-draft", () => ({ createAutoDraftForRenderJob: mocks.createAutoDraft }));

const jobId = "44444444-4444-4444-8444-444444444444";
const content = {
  hook: "Prêt ?",
  script_segments: [{ highlight_id: "hl-intro", text: "Prêt ?" }],
  cta: "Lien en bio.",
  caption: "Description.",
  hashtags: ["trail"],
  cover_text: "Prêt ?",
};
const baseJob = {
  id: jobId,
  race_id: "33333333-3333-4333-8333-333333333333",
  race_title: "SaintéLyon",
  status: "running" as const,
  content,
  created_by: "55555555-5555-4555-8555-555555555555",
  auto_draft: true,
};

const report = (body: unknown) =>
  POST(new Request(`http://localhost/api/video-render/jobs/${jobId}`, { method: "POST", body: JSON.stringify(body) }), { params: { id: jobId } });
const done = () => report({ status: "done" });

const gateWith = (job: Record<string, unknown>) =>
  mocks.gate.mockResolvedValue({ ok: true, value: { supabase: { supabaseUrl: "https://db.example" }, config: {}, job } });

describe("POST /api/video-render/jobs/[id] (completion)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.gate.mockReset();
    mocks.updateRenderJob.mockReset();
    mocks.createAutoDraft.mockReset();
    mocks.createAutoDraft.mockResolvedValue({ post: { id: "post" }, created: true });
    gateWith(baseJob);
    mocks.updateRenderJob.mockImplementation(async (_s: unknown, _id: string, patch: Record<string, unknown>) => ({ ...baseJob, ...patch }));
  });

  it("creates the automatic draft once the job is done, for the job that asked for it", async () => {
    const response = await done();
    expect(response.status).toBe(200);
    expect(mocks.updateRenderJob.mock.calls[0][2]).toMatchObject({ status: "done", progress: 1 });
    expect(mocks.createAutoDraft).toHaveBeenCalledTimes(1);
    expect(mocks.createAutoDraft.mock.calls[0][1]).toMatchObject({ id: jobId, auto_draft: true, created_by: baseJob.created_by });
  });

  it("creates nothing without the flag or without reel content", async () => {
    mocks.updateRenderJob.mockResolvedValue({ ...baseJob, status: "done", auto_draft: false });
    expect((await done()).status).toBe(200);
    mocks.updateRenderJob.mockResolvedValue({ ...baseJob, status: "done", content: null });
    expect((await done()).status).toBe(200);
    expect(mocks.createAutoDraft).not.toHaveBeenCalled();
  });

  it("creates nothing for progress or failure reports", async () => {
    expect((await report({ status: "running", progress: 0.4 })).status).toBe(200);
    expect((await report({ status: "failed", message: "boom" })).status).toBe(200);
    expect(mocks.createAutoDraft).not.toHaveBeenCalled();
  });

  it("goes through the idempotent creation again when the callback is retried on a done job", async () => {
    gateWith({ ...baseJob, status: "done" });
    // The guarded update finds no active row: the job was already finished by the first call.
    mocks.updateRenderJob.mockResolvedValue(null);
    expect((await done()).status).toBe(200);
    expect(mocks.createAutoDraft).toHaveBeenCalledTimes(1);
    expect(mocks.createAutoDraft.mock.calls[0][1]).toMatchObject({ id: jobId });
  });

  it("does not create a draft for a retried callback on a job that is not done", async () => {
    gateWith({ ...baseJob, status: "failed" });
    mocks.updateRenderJob.mockResolvedValue(null);
    expect((await done()).status).toBe(200);
    expect(mocks.createAutoDraft).not.toHaveBeenCalled();
  });

  it("keeps the job done when the draft cannot be created, and logs without the payload", async () => {
    mocks.createAutoDraft.mockRejectedValue(new Error("Unable to create social post (500)."));
    const response = await done();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(console.error).toHaveBeenCalledWith("Automatic social draft failed", "Unable to create social post (500).");
  });
});
