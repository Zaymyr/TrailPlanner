import { afterEach, describe, expect, it, vi } from "vitest";

import { modeMismatchMessage, type SocialPostRepository, type SocialPostRow } from "../social-posts";
import { createDryRunGraphClient, InstagramGraphError, type InstagramGraphClient } from "./graph";
import { advanceSocialPost, claimAndAdvance, MANUAL_CHECK_NOTE, runPublishingTick, type PublisherDeps } from "./publisher";

const NOW = new Date("2026-11-19T10:00:00Z");

const basePost = (overrides: Partial<SocialPostRow> = {}): SocialPostRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  race_id: "22222222-2222-4222-8222-222222222222",
  video_job_id: "33333333-3333-4333-8333-333333333333",
  platform: "instagram",
  status: "publishing",
  caption: "Le parcours",
  hashtags: ["trail"],
  cover_text: null,
  video_url: "jobs/33333333-3333-4333-8333-333333333333/reel.mp4",
  scheduled_at: NOW.toISOString(),
  published_at: null,
  ig_container_id: null,
  ig_container_created_at: null,
  publish_requested_at: null,
  ig_media_id: null,
  ig_permalink: null,
  error: null,
  dry_run: false,
  attempt_count: 0,
  locked_until: null,
  content: null,
  created_by: null,
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
  ...overrides,
});

/** In-memory repository honoring the PostgREST filters the publisher uses. */
const memoryRepository = (initial: SocialPostRow[]) => {
  const store = new Map(initial.map((row) => [row.id, { ...row }]));
  const matches = (row: SocialPostRow, filter = "") => filter.split("&").filter(Boolean).every((clause) => {
    const [column, expression] = clause.split("=");
    const value = (row as Record<string, unknown>)[column];
    if (expression === "is.null") return value === null;
    if (expression.startsWith("eq.")) return String(value) === expression.slice(3);
    if (expression.startsWith("in.(")) return expression.slice(4, -1).split(",").includes(String(value));
    throw new Error(`Unsupported filter ${clause}`);
  });
  const leaseFree = (row: SocialPostRow, now: Date) => !row.locked_until || Date.parse(row.locked_until) < now.getTime();
  const repository: SocialPostRepository = {
    get: async (id) => (store.has(id) ? { ...store.get(id)! } : null),
    list: async () => Array.from(store.values()),
    insert: async () => { throw new Error("not used"); },
    update: async (id, patch, filter) => {
      const row = store.get(id);
      if (!row || !matches(row, filter)) return null;
      Object.assign(row, patch);
      return { ...row };
    },
    remove: async () => false,
    promoteDue: async (now, dryRun) => {
      const promoted: SocialPostRow[] = [];
      const refused: SocialPostRow[] = [];
      store.forEach((row) => {
        if (row.status === "scheduled" && row.scheduled_at && Date.parse(row.scheduled_at) <= now.getTime()) {
          if (row.dry_run === dryRun) {
            Object.assign(row, { status: "publishing", attempt_count: 0, error: null, locked_until: null });
            promoted.push({ ...row });
          } else {
            Object.assign(row, { status: "failed", error: modeMismatchMessage(row.dry_run), locked_until: null });
            refused.push({ ...row });
          }
        }
      });
      return { promoted, refused };
    },
    listRunnable: async (now) => Array.from(store.values()).filter((row) => row.status === "publishing" && leaseFree(row, now)).map((row) => ({ ...row })),
    claim: async (id, now, until) => {
      const row = store.get(id);
      if (!row || row.status !== "publishing" || !leaseFree(row, now)) return null;
      row.locked_until = until.toISOString();
      return { ...row };
    },
  };
  return { repository, store };
};

const fakeGraph = (overrides: Partial<InstagramGraphClient> = {}): InstagramGraphClient & Record<string, ReturnType<typeof vi.fn>> => ({
  createReelContainer: vi.fn().mockResolvedValue("container-1"),
  getContainerStatus: vi.fn().mockResolvedValue({ statusCode: "FINISHED", status: null }),
  publishContainer: vi.fn().mockResolvedValue("media-1"),
  getPermalink: vi.fn().mockResolvedValue("https://www.instagram.com/reel/abc/"),
  getPublishingLimit: vi.fn().mockResolvedValue({ usage: 1, total: 50, durationSeconds: 86400 }),
  listRecentMedia: vi.fn().mockResolvedValue([]),
  ...overrides,
}) as InstagramGraphClient & Record<string, ReturnType<typeof vi.fn>>;

const makeDeps = (repository: SocialPostRepository, graph: InstagramGraphClient, now = NOW, extra: Partial<PublisherDeps> = {}) => {
  let current = now;
  const deps: PublisherDeps = {
    posts: repository,
    now: () => current,
    graphFor: (dryRun) => (dryRun ? createDryRunGraphClient() : graph),
    getAccount: vi.fn().mockResolvedValue({ igUserId: "1784", accessToken: "TOKEN" }),
    getVideoJob: vi.fn().mockResolvedValue({ status: "done", finished_at: "2026-11-18T10:00:00Z" }),
    signVideoUrl: vi.fn().mockResolvedValue("https://storage.googleapis.com/signed"),
    ...extra,
  };
  return { deps, advanceClock: (ms: number) => { current = new Date(current.getTime() + ms); } };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("publishing state machine", () => {
  it("creates the container, waits while Meta processes, then publishes exactly once", async () => {
    const { repository, store } = memoryRepository([basePost()]);
    const graph = fakeGraph({
      getContainerStatus: vi.fn()
        .mockResolvedValueOnce({ statusCode: "IN_PROGRESS", status: null })
        .mockResolvedValueOnce({ statusCode: "FINISHED", status: null }),
    });
    const { deps, advanceClock } = makeDeps(repository, graph);
    const id = basePost().id;

    expect((await claimAndAdvance(id, deps))?.outcome).toBe("container_created");
    expect(store.get(id)?.ig_container_id).toBe("container-1");
    expect(deps.signVideoUrl).toHaveBeenCalledWith("jobs/33333333-3333-4333-8333-333333333333/reel.mp4");
    expect(graph.createReelContainer).toHaveBeenCalledWith(expect.objectContaining({ caption: "Le parcours\n\n#trail", videoUrl: "https://storage.googleapis.com/signed" }));

    // The lease throttles the next status check to once a minute.
    expect(await claimAndAdvance(id, deps)).toBeNull();
    advanceClock(61_000);
    expect((await claimAndAdvance(id, deps))?.outcome).toBe("waiting");
    advanceClock(61_000);
    const done = await claimAndAdvance(id, deps);
    expect(done?.outcome).toBe("published");
    expect(store.get(id)).toMatchObject({ status: "published", ig_media_id: "media-1", ig_permalink: "https://www.instagram.com/reel/abc/" });
    expect(graph.createReelContainer).toHaveBeenCalledTimes(1);
    expect(graph.publishContainer).toHaveBeenCalledTimes(1);
  });

  it("resumes from the stored container id instead of creating a second one", async () => {
    const { repository } = memoryRepository([basePost({ ig_container_id: "container-9", ig_container_created_at: NOW.toISOString(), locked_until: "2026-11-19T09:00:00Z" })]);
    const graph = fakeGraph();
    const { deps } = makeDeps(repository, graph);
    const result = await claimAndAdvance(basePost().id, deps);
    expect(result?.outcome).toBe("published");
    expect(graph.createReelContainer).not.toHaveBeenCalled();
    expect(graph.publishContainer).toHaveBeenCalledWith("1784", "container-9", "TOKEN");
  });

  it("never calls media_publish again once a media id is stored", async () => {
    const { repository, store } = memoryRepository([basePost({ ig_container_id: "c", ig_media_id: "media-7" })]);
    const graph = fakeGraph();
    const { deps } = makeDeps(repository, graph);
    await claimAndAdvance(basePost().id, deps);
    expect(graph.publishContainer).not.toHaveBeenCalled();
    expect(graph.getContainerStatus).not.toHaveBeenCalled();
    expect(store.get(basePost().id)).toMatchObject({ status: "published", ig_media_id: "media-7" });
  });

  it("keeps a stored media id published even when the credentials are now missing", async () => {
    const { repository, store } = memoryRepository([basePost({ ig_container_id: "c", ig_media_id: "media-7" })]);
    const graph = fakeGraph();
    const { deps } = makeDeps(repository, graph, NOW, { getAccount: vi.fn().mockResolvedValue({ error: "IG_SYSTEM_USER_TOKEN ou IG_USER_ID absent : publication réelle impossible." }) });
    expect((await claimAndAdvance(basePost().id, deps))?.outcome).toBe("published");
    expect(graph.publishContainer).not.toHaveBeenCalled();
    expect(store.get(basePost().id)).toMatchObject({ status: "published", ig_media_id: "media-7" });
  });

  it("marks a PUBLISHED container as published without publishing twice", async () => {
    const { repository, store } = memoryRepository([basePost({ ig_container_id: "c", ig_container_created_at: NOW.toISOString(), publish_requested_at: NOW.toISOString() })]);
    const graph = fakeGraph({ getContainerStatus: vi.fn().mockResolvedValue({ statusCode: "PUBLISHED", status: null }) });
    const { deps } = makeDeps(repository, graph);
    expect((await claimAndAdvance(basePost().id, deps))?.outcome).toBe("published");
    expect(graph.publishContainer).not.toHaveBeenCalled();
    expect(store.get(basePost().id)).toMatchObject({ status: "published", ig_media_id: null, error: MANUAL_CHECK_NOTE });
  });

  it("fails on an ERROR or EXPIRED container and drops it so a retry starts over", async () => {
    for (const statusCode of ["ERROR", "EXPIRED"] as const) {
      const { repository, store } = memoryRepository([basePost({ ig_container_id: "c", ig_container_created_at: NOW.toISOString() })]);
      const graph = fakeGraph({ getContainerStatus: vi.fn().mockResolvedValue({ statusCode, status: "Error: bad codec" }) });
      const { deps } = makeDeps(repository, graph);
      expect((await claimAndAdvance(basePost().id, deps))?.outcome).toBe("failed");
      expect(store.get(basePost().id)).toMatchObject({ status: "failed", ig_container_id: null });
      expect(graph.publishContainer).not.toHaveBeenCalled();
    }
  });

  it("fails with the token message on an invalid token or missing permission and keeps the container", async () => {
    for (const code of [190, 10, 200]) {
      const { repository, store } = memoryRepository([basePost({ ig_container_id: "c", ig_container_created_at: NOW.toISOString() })]);
      const graph = fakeGraph({ getContainerStatus: vi.fn().mockRejectedValue(new InstagramGraphError("Invalid OAuth access token", "auth", { code })) });
      expect((await claimAndAdvance(basePost().id, makeDeps(repository, graph).deps))?.outcome).toBe("failed");
      const row = store.get(basePost().id)!;
      expect(row).toMatchObject({ status: "failed", ig_container_id: "c" });
      expect(row.error).toContain("Jeton Instagram invalide ou droits insuffisants — vérifier IG_SYSTEM_USER_TOKEN");
      expect(row.error).not.toContain("TOKEN)");
    }
  });

  it("fails clearly when the credentials are missing for a live post", async () => {
    const { repository, store } = memoryRepository([basePost()]);
    const { deps } = makeDeps(repository, fakeGraph(), NOW, {
      getAccount: vi.fn().mockResolvedValue({ error: "IG_SYSTEM_USER_TOKEN ou IG_USER_ID absent : publication réelle impossible." }),
    });
    expect((await claimAndAdvance(basePost().id, deps))?.outcome).toBe("failed");
    expect(store.get(basePost().id)?.error).toContain("IG_SYSTEM_USER_TOKEN");
  });

  it("backs off on a rate limit and on an exhausted quota", async () => {
    const limited = memoryRepository([basePost({ ig_container_id: "c", ig_container_created_at: NOW.toISOString() })]);
    const graph = fakeGraph({ publishContainer: vi.fn().mockRejectedValue(new InstagramGraphError("limit", "rate_limit", { code: 4 })) });
    const { deps } = makeDeps(limited.repository, graph);
    expect((await claimAndAdvance(basePost().id, deps))?.outcome).toBe("waiting");
    expect(limited.store.get(basePost().id)).toMatchObject({ status: "publishing", locked_until: "2026-11-19T10:15:00.000Z" });

    const quota = memoryRepository([basePost()]);
    const quotaGraph = fakeGraph({ getPublishingLimit: vi.fn().mockResolvedValue({ usage: 50, total: 50, durationSeconds: 86400 }) });
    expect((await claimAndAdvance(basePost().id, makeDeps(quota.repository, quotaGraph).deps))?.outcome).toBe("waiting");
    expect(quotaGraph.createReelContainer).not.toHaveBeenCalled();
  });

  it("retries transient errors a bounded number of times", async () => {
    const { repository, store } = memoryRepository([basePost({ attempt_count: 7 })]);
    const graph = fakeGraph({ createReelContainer: vi.fn().mockRejectedValue(new InstagramGraphError("down", "transient", { httpStatus: 503 })) });
    expect((await claimAndAdvance(basePost().id, makeDeps(repository, graph).deps))?.outcome).toBe("failed");
    expect(store.get(basePost().id)?.attempt_count).toBe(8);
  });

  it("fails cleanly when the video was deleted or reaches the end of its storage lifetime", async () => {
    const deleted = memoryRepository([basePost({ video_job_id: null })]);
    expect((await claimAndAdvance(basePost().id, makeDeps(deleted.repository, fakeGraph()).deps))?.outcome).toBe("failed");

    const old = memoryRepository([basePost()]);
    const { deps } = makeDeps(old.repository, fakeGraph(), NOW, {
      getVideoJob: vi.fn().mockResolvedValue({ status: "done", finished_at: "2026-10-20T12:00:00Z" }),
    });
    expect((await claimAndAdvance(basePost().id, deps))?.outcome).toBe("failed");
    expect(old.store.get(basePost().id)?.error).toContain("30 jours");
  });

  it("does not run a step without the lease or on a post that left publishing", async () => {
    const { repository } = memoryRepository([basePost({ locked_until: "2026-11-19T10:01:00Z" })]);
    const graph = fakeGraph();
    expect(await claimAndAdvance(basePost().id, makeDeps(repository, graph).deps)).toBeNull();
    expect((await advanceSocialPost(basePost({ status: "draft" }), makeDeps(repository, graph).deps)).outcome).toBe("skipped");
    expect(graph.createReelContainer).not.toHaveBeenCalled();
  });

  it("refuses to push dry-run ids to Meta when the post became live", async () => {
    const { repository, store } = memoryRepository([basePost({ ig_container_id: "dry-run-container-1" })]);
    const graph = fakeGraph();
    await claimAndAdvance(basePost().id, makeDeps(repository, graph).deps);
    expect(graph.getContainerStatus).not.toHaveBeenCalled();
    expect(store.get(basePost().id)).toMatchObject({ status: "failed", ig_container_id: null });
  });
});

describe("after a publish was requested", () => {
  const requested = (overrides: Partial<SocialPostRow> = {}) => basePost({
    // Scheduled two days ago, container created and publish requested 25 h ago.
    scheduled_at: "2026-11-17T10:00:00Z",
    ig_container_id: "container-9",
    ig_container_created_at: "2026-11-18T09:00:00Z",
    publish_requested_at: "2026-11-18T09:00:00Z",
    ...overrides,
  });

  it("checks the container before any 24 h rule and recovers the published media", async () => {
    const { repository, store } = memoryRepository([requested()]);
    const graph = fakeGraph({
      getContainerStatus: vi.fn().mockResolvedValue({ statusCode: "PUBLISHED", status: null }),
      listRecentMedia: vi.fn().mockResolvedValue([
        { id: "older", permalink: "https://www.instagram.com/reel/old/", timestampMs: Date.parse("2026-11-10T09:00:00Z"), mediaProductType: "REELS" },
        { id: "media-9", permalink: "https://www.instagram.com/reel/new/", timestampMs: Date.parse("2026-11-18T09:00:30Z"), mediaProductType: "REELS" },
      ]),
    });
    expect((await claimAndAdvance(basePost().id, makeDeps(repository, graph).deps))?.outcome).toBe("published");
    expect(store.get(basePost().id)).toMatchObject({ status: "published", ig_media_id: "media-9", ig_permalink: "https://www.instagram.com/reel/new/", error: null });
    expect(graph.createReelContainer).not.toHaveBeenCalled();
    expect(graph.publishContainer).not.toHaveBeenCalled();
  });

  it("keeps every id and asks for a manual check when the old container is EXPIRED", async () => {
    const { repository, store } = memoryRepository([requested()]);
    const graph = fakeGraph({ getContainerStatus: vi.fn().mockResolvedValue({ statusCode: "EXPIRED", status: null }) });
    expect((await claimAndAdvance(basePost().id, makeDeps(repository, graph).deps))?.outcome).toBe("failed");
    expect(store.get(basePost().id)).toMatchObject({
      status: "failed",
      ig_container_id: "container-9",
      publish_requested_at: "2026-11-18T09:00:00Z",
    });
    expect(store.get(basePost().id)?.error).toContain("vérifie sur Instagram");
    expect(graph.createReelContainer).not.toHaveBeenCalled();
    expect(graph.publishContainer).not.toHaveBeenCalled();
  });

  it("publishes again only when Meta confirms the container is still FINISHED", async () => {
    const { repository, store } = memoryRepository([requested()]);
    const graph = fakeGraph();
    expect((await claimAndAdvance(basePost().id, makeDeps(repository, graph).deps))?.outcome).toBe("published");
    expect(graph.publishContainer).toHaveBeenCalledTimes(1);
    expect(store.get(basePost().id)?.ig_media_id).toBe("media-1");
  });

  it("recovers the media id when the media_publish response was lost", async () => {
    const { repository, store } = memoryRepository([basePost({ ig_container_id: "container-1", ig_container_created_at: NOW.toISOString() })]);
    const graph = fakeGraph({
      getContainerStatus: vi.fn()
        .mockResolvedValueOnce({ statusCode: "FINISHED", status: null })
        .mockResolvedValueOnce({ statusCode: "PUBLISHED", status: null }),
      // Meta published the reel, but the response never came back.
      publishContainer: vi.fn().mockRejectedValue(new InstagramGraphError("Instagram injoignable.", "transient")),
      listRecentMedia: vi.fn().mockResolvedValue([
        { id: "media-lost", permalink: "https://www.instagram.com/reel/lost/", timestampMs: NOW.getTime() + 2_000, mediaProductType: "REELS" },
      ]),
    });
    const { deps, advanceClock } = makeDeps(repository, graph);
    expect((await claimAndAdvance(basePost().id, deps))?.outcome).toBe("retry_later");
    expect(store.get(basePost().id)?.publish_requested_at).toBe(NOW.toISOString());
    advanceClock(3 * 60_000);
    expect((await claimAndAdvance(basePost().id, deps))?.outcome).toBe("published");
    expect(store.get(basePost().id)).toMatchObject({ status: "published", ig_media_id: "media-lost" });
    expect(graph.publishContainer).toHaveBeenCalledTimes(1);
    expect(graph.createReelContainer).not.toHaveBeenCalled();
  });

  it("marks the post for a manual check when the media cannot be identified", async () => {
    const { repository, store } = memoryRepository([requested()]);
    const graph = fakeGraph({
      getContainerStatus: vi.fn().mockResolvedValue({ statusCode: "PUBLISHED", status: null }),
      listRecentMedia: vi.fn().mockResolvedValue([
        { id: "a", permalink: null, timestampMs: Date.parse("2026-11-18T09:01:00Z"), mediaProductType: "REELS" },
        { id: "b", permalink: null, timestampMs: Date.parse("2026-11-18T09:02:00Z"), mediaProductType: "REELS" },
      ]),
    });
    await claimAndAdvance(basePost().id, makeDeps(repository, graph).deps);
    expect(store.get(basePost().id)).toMatchObject({ status: "published", ig_media_id: null, error: MANUAL_CHECK_NOTE });
  });
});

describe("mode changes", () => {
  it("never publishes for real a post scheduled in simulation", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { repository, store } = memoryRepository([basePost({ status: "scheduled", scheduled_at: "2026-11-19T09:55:00Z", dry_run: true })]);
    const graph = fakeGraph();
    const { deps } = makeDeps(repository, graph);
    const result = await runPublishingTick({ ...deps, dryRun: false });
    expect(result).toMatchObject({ promoted: 0, refused: 1, processed: [] });
    expect(store.get(basePost().id)).toMatchObject({ status: "failed", dry_run: true, error: modeMismatchMessage(true) });
    expect(graph.createReelContainer).not.toHaveBeenCalled();
    expect(deps.getAccount).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not simulate a post scheduled for a real publication either", async () => {
    const { repository, store } = memoryRepository([basePost({ status: "scheduled", scheduled_at: "2026-11-19T09:55:00Z", dry_run: false })]);
    await runPublishingTick({ ...makeDeps(repository, fakeGraph()).deps, dryRun: true });
    expect(store.get(basePost().id)).toMatchObject({ status: "failed", dry_run: false, error: modeMismatchMessage(false) });
  });
});

describe("dry run", () => {
  it("runs a scheduled post end to end within one tick with zero network calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { repository, store } = memoryRepository([basePost({ status: "scheduled", scheduled_at: "2026-11-19T09:55:00Z", dry_run: true })]);
    const graph = fakeGraph();
    const { deps } = makeDeps(repository, graph);

    const result = await runPublishingTick({ ...deps, dryRun: true });
    expect(result.promoted).toBe(1);
    const row = store.get(basePost().id)!;
    expect(row).toMatchObject({ status: "published", dry_run: true, ig_permalink: null });
    expect(row.ig_media_id?.startsWith("dry-run-media-")).toBe(true);
    expect(row.ig_container_id?.startsWith("dry-run-container-")).toBe(true);
    expect(graph.createReelContainer).not.toHaveBeenCalled();
    expect(deps.signVideoUrl).not.toHaveBeenCalled();
    expect(deps.getAccount).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("leaves drafts and future posts alone", async () => {
    const { repository, store } = memoryRepository([
      basePost({ id: "44444444-4444-4444-8444-444444444444", status: "draft", scheduled_at: null }),
      basePost({ status: "scheduled", scheduled_at: "2026-11-19T12:00:00Z" }),
    ]);
    const { deps } = makeDeps(repository, fakeGraph());
    const result = await runPublishingTick({ ...deps, dryRun: true });
    expect(result).toEqual({ promoted: 0, refused: 0, processed: [] });
    expect(store.get("44444444-4444-4444-8444-444444444444")?.status).toBe("draft");
    expect(store.get(basePost().id)?.status).toBe("scheduled");
  });
});

describe("carousel publishing", () => {
  const carouselPost = (overrides: Partial<SocialPostRow> = {}) => basePost({
    video_job_id: null,
    video_url: null,
    media_type: "carousel",
    carousel_series: "plan",
    carousel_job_id: "44444444-4444-4444-8444-444444444444",
    image_paths: ["carousels/j/slide-1.jpg", "carousels/j/slide-2.jpg", "carousels/j/slide-3.jpg"],
    ig_child_container_ids: [],
    ...overrides,
  });
  const carouselGraph = (overrides: Partial<InstagramGraphClient> = {}) => {
    let child = 0;
    return fakeGraph({
      createCarouselItemContainer: vi.fn().mockImplementation(async () => `item-${(child += 1)}`),
      createCarouselContainer: vi.fn().mockResolvedValue("carousel-1"),
      ...overrides,
    });
  };
  const carouselExtra = () => ({
    getCarouselJob: vi.fn().mockResolvedValue({ status: "done", finished_at: "2026-11-18T10:00:00Z" }),
    signImageUrl: vi.fn().mockImplementation(async (path: string) => `https://storage.googleapis.com/signed/${path}`),
  });

  it("creates one item container per image in order, then the carousel container, then publishes once", async () => {
    const { repository, store } = memoryRepository([carouselPost()]);
    const graph = carouselGraph();
    const { deps, advanceClock } = makeDeps(repository, graph, NOW, carouselExtra());
    const id = basePost().id;

    expect((await claimAndAdvance(id, deps))?.outcome).toBe("container_created");
    expect(graph.createCarouselItemContainer.mock.calls.map(([input]) => input.imageUrl)).toEqual([
      "https://storage.googleapis.com/signed/carousels/j/slide-1.jpg",
      "https://storage.googleapis.com/signed/carousels/j/slide-2.jpg",
      "https://storage.googleapis.com/signed/carousels/j/slide-3.jpg",
    ]);
    expect(graph.createCarouselContainer).toHaveBeenCalledWith(expect.objectContaining({ children: ["item-1", "item-2", "item-3"], caption: "Le parcours\n\n#trail" }));
    expect(graph.createReelContainer).not.toHaveBeenCalled();
    expect(store.get(id)).toMatchObject({ ig_container_id: "carousel-1", ig_child_container_ids: ["item-1", "item-2", "item-3"] });

    advanceClock(61_000);
    expect((await claimAndAdvance(id, deps))?.outcome).toBe("published");
    expect(graph.publishContainer).toHaveBeenCalledTimes(1);
    expect(graph.publishContainer).toHaveBeenCalledWith("1784", "carousel-1", "TOKEN");
    expect(store.get(id)?.status).toBe("published");
  });

  it("resumes after the item containers already stored instead of creating them again", async () => {
    const { repository } = memoryRepository([carouselPost({ ig_child_container_ids: ["item-a", "item-b"] })]);
    const graph = carouselGraph();
    const { deps } = makeDeps(repository, graph, NOW, carouselExtra());
    await claimAndAdvance(basePost().id, deps);
    expect(graph.createCarouselItemContainer).toHaveBeenCalledTimes(1);
    expect(graph.createCarouselContainer).toHaveBeenCalledWith(expect.objectContaining({ children: ["item-a", "item-b", "item-1"] }));
  });

  it("keeps the item containers created before an error, for the retry", async () => {
    const { repository, store } = memoryRepository([carouselPost()]);
    const graph = carouselGraph({
      createCarouselItemContainer: vi.fn().mockResolvedValueOnce("item-1").mockRejectedValueOnce(new InstagramGraphError("Boom", "transient")),
    });
    const { deps } = makeDeps(repository, graph, NOW, carouselExtra());
    expect((await claimAndAdvance(basePost().id, deps))?.outcome).toBe("retry_later");
    expect(store.get(basePost().id)).toMatchObject({ ig_child_container_ids: ["item-1"], ig_container_id: null });
  });

  it("fails without its images and drops the item containers with an expired carousel", async () => {
    const missing = memoryRepository([carouselPost({ carousel_job_id: null })]);
    const { deps } = makeDeps(missing.repository, carouselGraph(), NOW, carouselExtra());
    expect((await claimAndAdvance(basePost().id, deps))?.outcome).toBe("failed");

    const expired = memoryRepository([carouselPost({ ig_container_id: "carousel-1", ig_container_created_at: NOW.toISOString(), ig_child_container_ids: ["item-1", "item-2"] })]);
    const graph = carouselGraph({ getContainerStatus: vi.fn().mockResolvedValue({ statusCode: "EXPIRED", status: null }) });
    const second = makeDeps(expired.repository, graph, NOW, carouselExtra());
    expect((await claimAndAdvance(basePost().id, second.deps))?.outcome).toBe("failed");
    expect(expired.store.get(basePost().id)).toMatchObject({ ig_container_id: null, ig_child_container_ids: [] });
  });

  it("recovers a lost media id among FEED media, never REELS", async () => {
    const { repository, store } = memoryRepository([carouselPost({ ig_container_id: "carousel-1", ig_container_created_at: NOW.toISOString(), publish_requested_at: NOW.toISOString() })]);
    const graph = carouselGraph({
      getContainerStatus: vi.fn().mockResolvedValue({ statusCode: "PUBLISHED", status: null }),
      listRecentMedia: vi.fn().mockResolvedValue([
        { id: "reel-9", permalink: "https://www.instagram.com/reel/x/", timestampMs: NOW.getTime(), mediaProductType: "REELS" },
        { id: "feed-9", permalink: "https://www.instagram.com/p/y/", timestampMs: NOW.getTime(), mediaProductType: "FEED" },
      ]),
    });
    const { deps } = makeDeps(repository, graph, NOW, carouselExtra());
    await claimAndAdvance(basePost().id, deps);
    expect(store.get(basePost().id)).toMatchObject({ status: "published", ig_media_id: "feed-9" });
    expect(graph.publishContainer).not.toHaveBeenCalled();
  });

  it("runs a dry-run carousel to the end without signing anything", async () => {
    const { repository, store } = memoryRepository([carouselPost({ dry_run: true })]);
    const extra = carouselExtra();
    const { deps } = makeDeps(repository, carouselGraph(), NOW, extra);
    await advancePostForTest(basePost().id, deps);
    expect(store.get(basePost().id)?.status).toBe("published");
    expect(store.get(basePost().id)?.ig_media_id).toMatch(/^dry-run-media-/);
    expect(extra.signImageUrl).not.toHaveBeenCalled();
  });
});

const advancePostForTest = async (id: string, deps: PublisherDeps) => {
  for (let step = 0; step < 5; step += 1) {
    const result = await claimAndAdvance(id, deps);
    if (!result || result.post.status !== "publishing") return result;
  }
  return null;
};
