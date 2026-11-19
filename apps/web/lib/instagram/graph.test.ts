import { afterEach, describe, expect, it, vi } from "vitest";

import {
  classifyGraphError,
  createDryRunGraphClient,
  createInstagramGraphClient,
  InstagramGraphError,
} from "./graph";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Instagram Graph client", () => {
  it("creates a REELS container, polls it, publishes it and reads the permalink", async () => {
    const fetcher = vi.fn<Parameters<typeof fetch>, Promise<Response>>()
      .mockResolvedValueOnce(json({ id: "container-1" }))
      .mockResolvedValueOnce(json({ status_code: "IN_PROGRESS", status: "In Progress", id: "container-1" }))
      .mockResolvedValueOnce(json({ status_code: "FINISHED", id: "container-1" }))
      .mockResolvedValueOnce(json({ id: "media-1" }))
      .mockResolvedValueOnce(json({ permalink: "https://www.instagram.com/reel/abc/", id: "media-1" }));
    const client = createInstagramGraphClient({ fetcher, version: "v27.0" });

    const containerId = await client.createReelContainer({
      igUserId: "1784",
      accessToken: "TOKEN",
      videoUrl: "https://storage.googleapis.com/bucket/jobs/1/reel.mp4?X-Goog-Signature=abc",
      caption: "Le parcours\n\n#trail",
    });
    expect(containerId).toBe("container-1");
    const [createUrl, createInit] = fetcher.mock.calls[0];
    expect(createUrl).toBe("https://graph.facebook.com/v27.0/1784/media");
    expect(createInit?.method).toBe("POST");
    const body = new URLSearchParams(String(createInit?.body));
    expect(body.get("media_type")).toBe("REELS");
    expect(body.get("share_to_feed")).toBe("true");
    expect(body.get("caption")).toBe("Le parcours\n\n#trail");
    expect(body.get("access_token")).toBe("TOKEN");
    expect(body.has("cover_url")).toBe(false);

    expect(await client.getContainerStatus("container-1", "TOKEN")).toEqual({ statusCode: "IN_PROGRESS", status: "In Progress" });
    expect(String(fetcher.mock.calls[1][0])).toContain("/v27.0/container-1?fields=status_code%2Cstatus");
    expect((await client.getContainerStatus("container-1", "TOKEN")).statusCode).toBe("FINISHED");
    expect(await client.publishContainer("1784", "container-1", "TOKEN")).toBe("media-1");
    expect(fetcher.mock.calls[3][0]).toBe("https://graph.facebook.com/v27.0/1784/media_publish");
    expect(new URLSearchParams(String(fetcher.mock.calls[3][1]?.body)).get("creation_id")).toBe("container-1");
    expect(await client.getPermalink("media-1", "TOKEN")).toBe("https://www.instagram.com/reel/abc/");
  });

  it("uses the configured Graph version on graph.facebook.com", async () => {
    vi.stubEnv("INSTAGRAM_GRAPH_API_VERSION", "v28.0");
    const fetcher = vi.fn().mockResolvedValue(json({ status_code: "ERROR", status: "Error: video too short" }));
    const client = createInstagramGraphClient({ fetcher });
    expect(await client.getContainerStatus("c", "T")).toEqual({ statusCode: "ERROR", status: "Error: video too short" });
    expect(String(fetcher.mock.calls[0][0]).startsWith("https://graph.facebook.com/v28.0/c?")).toBe(true);
  });

  it("falls back to v27.0 when the version variable is malformed", async () => {
    vi.stubEnv("INSTAGRAM_GRAPH_API_VERSION", "none");
    const fetcher = vi.fn().mockResolvedValue(json({ permalink: "https://www.instagram.com/reel/x/" }));
    await createInstagramGraphClient({ fetcher }).getPermalink("m", "T");
    expect(String(fetcher.mock.calls[0][0]).startsWith("https://graph.facebook.com/v27.0/m?")).toBe(true);
  });

  it("never echoes the System User token back in an error", async () => {
    vi.stubEnv("IG_SYSTEM_USER_TOKEN", "EAAGsystemusertoken123");
    const fetcher = vi.fn().mockResolvedValue(json({
      error: { message: "Invalid OAuth access token EAAGsystemusertoken123.", type: "OAuthException", code: 190 },
    }, 400));
    const error = await createInstagramGraphClient({ fetcher }).getPermalink("m", "EAAGsystemusertoken123").catch((caught: unknown) => caught);
    expect((error as InstagramGraphError).kind).toBe("auth");
    expect(JSON.stringify({ message: (error as Error).message, details: (error as InstagramGraphError).details })).not.toContain("EAAGsystemusertoken123");
  });

  it("classifies permission errors (codes 10 and 200) as auth", () => {
    expect(classifyGraphError(400, 190)).toBe("auth");
    expect(classifyGraphError(403, 10)).toBe("auth");
    expect(classifyGraphError(400, 200)).toBe("auth");
  });

  it("reads the account username and profile", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ username: "pace_your.self", name: "Pace Yourself", id: "1784" }));
    expect(await createInstagramGraphClient({ fetcher, version: "v27.0" }).getAccountProfile("1784", "T")).toEqual({
      username: "pace_your.self", name: "Pace Yourself", profilePictureUrl: null,
    });
    expect(String(fetcher.mock.calls[0][0])).toContain("https://graph.facebook.com/v27.0/1784?fields=username%2Cname%2Cprofile_picture_url");
  });

  it("classifies an expired token as an auth error without leaking it", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({
      error: { message: "Error validating access token: Session has expired access_token=SECRET", type: "OAuthException", code: 190, error_subcode: 463 },
    }, 400));
    const client = createInstagramGraphClient({ fetcher, version: "v27.0" });
    const error = await client.publishContainer("1", "c", "SECRET").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(InstagramGraphError);
    expect((error as InstagramGraphError).kind).toBe("auth");
    expect((error as InstagramGraphError).message).not.toContain("SECRET");
  });

  it("classifies rate limits and the publishing quota", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ error: { message: "Application request limit reached", code: 4 } }, 400));
    const error = await createInstagramGraphClient({ fetcher }).publishContainer("1", "c", "T").catch((caught: unknown) => caught);
    expect((error as InstagramGraphError).kind).toBe("rate_limit");
    expect(classifyGraphError(400, 9, 2207042)).toBe("rate_limit");
    expect(classifyGraphError(400, 9007, 2207027)).toBe("not_ready");
    expect(classifyGraphError(500)).toBe("transient");
    expect(classifyGraphError(400, 100)).toBe("permanent");
    expect(classifyGraphError(400, 10)).toBe("auth");
  });

  it("treats a network failure and an unexpected payload as transient", async () => {
    const offline = createInstagramGraphClient({ fetcher: vi.fn().mockRejectedValue(new TypeError("fetch failed")) });
    await expect(offline.getPermalink("m", "T")).rejects.toMatchObject({ kind: "transient" });
    const odd = createInstagramGraphClient({ fetcher: vi.fn().mockResolvedValue(json({ status_code: "UNKNOWN" })) });
    await expect(odd.getContainerStatus("c", "T")).rejects.toMatchObject({ kind: "transient" });
  });

  it("reads the content publishing limit", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ data: [{ quota_usage: 3, config: { quota_total: 50, quota_duration: 86400 } }] }));
    expect(await createInstagramGraphClient({ fetcher }).getPublishingLimit("1", "T")).toEqual({ usage: 3, total: 50, durationSeconds: 86400 });
  });

  it("lists the latest media to recover a lost media id", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ data: [
      { id: "m1", permalink: "https://www.instagram.com/reel/a/", timestamp: "2026-11-19T10:00:05+0000", media_product_type: "REELS" },
      { id: "m2", timestamp: "garbage" },
    ] }));
    const media = await createInstagramGraphClient({ fetcher, version: "v27.0" }).listRecentMedia("1784", "T");
    expect(media).toEqual([
      { id: "m1", permalink: "https://www.instagram.com/reel/a/", timestampMs: Date.parse("2026-11-19T10:00:05Z"), mediaProductType: "REELS" },
      { id: "m2", permalink: null, timestampMs: null, mediaProductType: null },
    ]);
    expect(String(fetcher.mock.calls[0][0])).toContain("/v27.0/1784/media?fields=id%2Cpermalink%2Ctimestamp%2Cmedia_product_type&limit=10");
  });

  it("simulates the whole flow without any network call in dry run", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const client = createDryRunGraphClient();
    const containerId = await client.createReelContainer({ igUserId: "x", accessToken: "x", videoUrl: "dry-run://v", caption: "c" });
    expect(containerId.startsWith("dry-run-container-")).toBe(true);
    expect((await client.getContainerStatus(containerId, "x")).statusCode).toBe("FINISHED");
    expect((await client.publishContainer("x", containerId, "x")).startsWith("dry-run-media-")).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
