import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({ gate: vi.fn(), insertRenderJob: vi.fn() }));

vi.mock("../../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../../lib/video-render-api")>("../../../../../lib/video-render-api");
  return { ...actual, authorizeRenderAdmin: mocks.gate };
});
vi.mock("../../../../../lib/video-render", async () => {
  const actual = await vi.importActual<typeof import("../../../../../lib/video-render")>("../../../../../lib/video-render");
  return {
    ...actual,
    insertRenderJob: mocks.insertRenderJob,
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
