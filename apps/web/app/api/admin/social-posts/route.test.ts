import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildDefaultCaption, DEFAULT_HASHTAGS } from "../../../../lib/social-posts";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({ gate: vi.fn(), getRenderJob: vi.fn(), insert: vi.fn(), list: vi.fn(), listJobs: vi.fn(), marks: vi.fn() }));

vi.mock("../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/video-render-api")>("../../../../lib/video-render-api");
  return { ...actual, authorizeVideoAdmin: mocks.gate };
});
vi.mock("../../../../lib/video-render", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/video-render")>("../../../../lib/video-render");
  return { ...actual, getRenderJob: mocks.getRenderJob };
});
vi.mock("../../../../lib/social-posts", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/social-posts")>("../../../../lib/social-posts");
  return {
    ...actual,
    createSocialPostRepository: () => ({ insert: mocks.insert, list: mocks.list }),
    listVideoJobsForPublishing: mocks.listJobs,
    readPublicationMarks: mocks.marks,
  };
});

const jobId = "55555555-5555-4555-8555-555555555555";
const content = {
  hook: "82 km, ça se prépare ?",
  script_segments: [{ highlight_id: "hl-intro", text: "82 km, ça se prépare ?" }],
  cta: "Lien en bio.",
  caption: "Une course de nuit exigeante. Plan de course dans l’appli (lien en bio).",
  hashtags: ["#Trail", "SaintéLyon", "paceyourself"],
  cover_text: "82 km de nuit",
};
const finishedAt = new Date(Date.now() - 60 * 60 * 1_000).toISOString();
const job = (extra: Record<string, unknown> = {}) => ({
  id: jobId, race_id: "66666666-6666-4666-8666-666666666666", race_title: "SaintéLyon", status: "done", width: 1080, height: 1920, finished_at: finishedAt, ...extra,
});
const post = (body: unknown) => new Request("http://localhost/api/admin/social-posts", {
  method: "POST",
  headers: { authorization: "Bearer admin", "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("Publications drafts from a render job", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: "admin", supabase: { supabaseUrl: "https://db", supabaseServiceRoleKey: "s" } } });
    mocks.list.mockResolvedValue([]);
    mocks.marks.mockResolvedValue({ byVideo: {}, byRace: {} });
    mocks.insert.mockImplementation(async (row: Record<string, unknown>) => ({
      id: "77777777-7777-4777-8777-777777777777", platform: "instagram", status: "draft", scheduled_at: null, published_at: null,
      ig_container_id: null, ig_container_created_at: null, publish_requested_at: null, ig_media_id: null, ig_permalink: null,
      error: null, attempt_count: 0, locked_until: null, content: null, created_at: finishedAt, updated_at: finishedAt, ...row,
    }));
  });

  it("pre-fills the draft form from the content of the video", async () => {
    mocks.listJobs.mockResolvedValue(new Map([[jobId, job({ content })]]));
    const { videos } = await (await GET(new Request("http://localhost/api/admin/social-posts"))).json();
    expect(videos[0]).toMatchObject({
      defaultCaption: content.caption,
      defaultHashtags: ["trail", "saintelyon", "paceyourself"],
      defaultCoverText: "82 km de nuit",
      hasContent: true,
    });
  });

  it("keeps the plain template for a video without content, or with an unreadable one", async () => {
    mocks.listJobs.mockResolvedValue(new Map([[jobId, job({ content: null })], ["other", job({ id: "other", content: { hook: 3 } })]]));
    const { videos } = await (await GET(new Request("http://localhost/api/admin/social-posts"))).json();
    expect(videos).toHaveLength(2);
    for (const video of videos) {
      expect(video).toMatchObject({
        defaultCaption: buildDefaultCaption("SaintéLyon"),
        defaultHashtags: DEFAULT_HASHTAGS,
        defaultCoverText: null,
        hasContent: false,
      });
    }
  });

  it("copies the full content JSON of the render job into the draft, whatever the form sent", async () => {
    mocks.getRenderJob.mockResolvedValue(job({ content }));
    const response = await POST(post({ videoJobId: jobId, caption: "Texte relu à la main.", hashtags: ["trail"], coverText: "Autre" }));
    expect(response.status).toBe(201);
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({
      video_job_id: jobId,
      status: "draft",
      caption: "Texte relu à la main.",
      hashtags: ["trail"],
      cover_text: "Autre",
      content,
    });
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("cover_url");
  });

  it("creates the draft without content for a video that has none", async () => {
    mocks.getRenderJob.mockResolvedValue(job({ content: null }));
    expect((await POST(post({ videoJobId: jobId, caption: "Texte.", hashtags: ["trail"] }))).status).toBe(201);
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("content");
  });
});

describe("Publications marks on the videos", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: "admin", supabase: { supabaseUrl: "https://db", supabaseServiceRoleKey: "s" } } });
    mocks.list.mockResolvedValue([]);
  });

  it("says which video and which race were already published", async () => {
    const mark = { state: "published", at: finishedAt, dryRun: false };
    mocks.listJobs.mockResolvedValue(new Map([[jobId, job()]]));
    mocks.marks.mockResolvedValue({ byVideo: { [jobId]: mark }, byRace: { [job().race_id]: mark } });
    const { videos } = await (await GET(new Request("http://localhost/api/admin/social-posts"))).json();
    expect(videos[0]).toMatchObject({ publication: mark, racePublication: mark });
  });

  it("leaves the marks empty for a video never posted", async () => {
    mocks.listJobs.mockResolvedValue(new Map([[jobId, job()]]));
    mocks.marks.mockResolvedValue({ byVideo: {}, byRace: {} });
    const { videos } = await (await GET(new Request("http://localhost/api/admin/social-posts"))).json();
    expect(videos[0]).toMatchObject({ publication: null, racePublication: null });
  });
});
