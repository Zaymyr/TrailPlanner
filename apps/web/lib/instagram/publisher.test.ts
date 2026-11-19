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
    getAccount: vi.fn().mockResolvedValue({ id: "account-1", igUserId: "1784", accessToken: "TOKEN" }),
    markNeedsReconnect: vi.fn().mockResolvedValue(undefined),
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

  it("keeps a stored media id published even when the account needs a reconnect", async () => {
    const { repository, store } = memoryRepository([basePost({ ig_container_id: "c", ig_media_id: "media-7" })]);
    const graph = fakeGraph();
    const { deps } = makeDeps(repository, graph, NOW, { getAccount: vi.fn().mockResolvedValue({ error: "Compte Instagram à reconnecter." }) });
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

  it("asks for a reconnect on an expired token and keeps the container", async () => {
    const { repository, store } = memoryRepository([basePost({ ig_container_id: "c", ig_container_created_at: NOW.toISOString() })]);
    const graph = fakeGraph({ getContainerStatus: vi.fn().mockRejectedValue(new InstagramGraphError("Session has expired", "auth", { code: 190 })) });
    const { deps } = makeDeps(repository, graph);
    expect((await claimAndAdvance(basePost().id, deps))?.outcome).toBe("failed");
    expect(deps.markNeedsReconnect).toHaveBeenCalledWith("account-1", "Session has expired");
    expect(store.get(basePost().id)).toMatchObject({ status: "failed", ig_container_id: "c" });
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
