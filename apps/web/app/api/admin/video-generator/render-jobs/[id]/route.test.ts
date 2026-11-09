import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE } from "./route";

const JOB_ID = "6f44391c-2fdb-4c0a-a095-8f62fd316229";

const mocks = vi.hoisted(() => ({
  getRenderJob: vi.fn(),
  deleteRenderJob: vi.fn(),
  deleteStorageObject: vi.fn(),
}));

vi.mock("../../../../../../lib/video-render", () => ({
  deleteRenderJob: mocks.deleteRenderJob,
  deleteStorageObject: mocks.deleteStorageObject,
  getGoogleAccessToken: () => Promise.resolve("google-token"),
  getRenderInputObject: (id: string) => `jobs/${id}/input.json`,
  getRenderJob: mocks.getRenderJob,
  getRenderOutputObject: (id: string) => `jobs/${id}/reel.mp4`,
}));

vi.mock("../../../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../../../lib/video-render-api")>("../../../../../../lib/video-render-api");
  return {
    ...actual,
    authorizeRenderAdmin: () => Promise.resolve({ ok: true, value: { userId: "admin", supabase: {}, config: { bucket: "renders" } } }),
  };
});

const call = () => DELETE(new Request(`http://localhost/api/admin/video-generator/render-jobs/${JOB_ID}`, { method: "DELETE" }), { params: { id: JOB_ID } });

describe("DELETE /api/admin/video-generator/render-jobs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteRenderJob.mockResolvedValue(true);
    mocks.deleteStorageObject.mockResolvedValue(true);
  });

  it("removes the MP4, the composition and the row of a finished render", async () => {
    mocks.getRenderJob.mockResolvedValue({ id: JOB_ID, status: "done" });
    const response = await call();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true, filesDeleted: true });
    expect(mocks.deleteStorageObject.mock.calls.map((args) => args[2])).toEqual([`jobs/${JOB_ID}/reel.mp4`, `jobs/${JOB_ID}/input.json`]);
    expect(mocks.deleteRenderJob).toHaveBeenCalledWith({}, JOB_ID);
  });

  it("still removes the row when the bucket refuses the deletion (lifecycle cleans it later)", async () => {
    mocks.getRenderJob.mockResolvedValue({ id: JOB_ID, status: "failed" });
    mocks.deleteStorageObject.mockResolvedValue(false);
    const response = await call();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true, filesDeleted: false });
  });

  it("keeps a render in progress", async () => {
    mocks.getRenderJob.mockResolvedValue({ id: JOB_ID, status: "running" });
    const response = await call();

    expect(response.status).toBe(409);
    expect(mocks.deleteStorageObject).not.toHaveBeenCalled();
    expect(mocks.deleteRenderJob).not.toHaveBeenCalled();
  });
});
