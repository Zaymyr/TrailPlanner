import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createRenderToken,
  getGoogleAccessToken,
  getReelFileName,
  isRenderJobStale,
  resetGoogleTokenCache,
  RENDER_TOKEN_TTL_SECONDS,
  runRenderJob,
  signStorageUrl,
  verifyRenderToken,
  VideoRenderSetupError,
  type VideoRenderConfig,
} from "./video-render";

const config: VideoRenderConfig = {
  projectId: "flowing-lead-513714-t2",
  projectNumber: "960460926584",
  serviceAccountEmail: "vercel-trigger@flowing-lead-513714-t2.iam.gserviceaccount.com",
  poolId: "vercel",
  providerId: "vercel",
  region: "europe-west1",
  bucket: "renders-bucket",
  jobName: "video-render",
  tokenSecret: "x".repeat(40),
};

const jobId = "11111111-1111-4111-8111-111111111111";

describe("render token", () => {
  it("accepts its own job before expiry only", () => {
    const now = Date.UTC(2026, 10, 4, 12);
    const token = createRenderToken(config.tokenSecret, jobId, now);
    expect(verifyRenderToken(config.tokenSecret, jobId, token, now)).toBe(true);
    expect(verifyRenderToken(config.tokenSecret, "22222222-2222-4222-8222-222222222222", token, now)).toBe(false);
    expect(verifyRenderToken("y".repeat(40), jobId, token, now)).toBe(false);
    expect(verifyRenderToken(config.tokenSecret, jobId, token, now + (RENDER_TOKEN_TTL_SECONDS + 1) * 1_000)).toBe(false);
    expect(verifyRenderToken(config.tokenSecret, jobId, `${token}x`, now)).toBe(false);
    expect(verifyRenderToken(config.tokenSecret, jobId, null, now)).toBe(false);
  });
});

describe("Google access", () => {
  afterEach(() => resetGoogleTokenCache());

  it("exchanges the Vercel OIDC token, then impersonates the service account", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://sts.googleapis.com/")) {
        const body = JSON.parse(String(init?.body));
        expect(body.subjectToken).toBe("vercel-oidc");
        expect(body.audience).toBe("//iam.googleapis.com/projects/960460926584/locations/global/workloadIdentityPools/vercel/providers/vercel");
        return Response.json({ access_token: "federated" });
      }
      expect(url).toContain(":generateAccessToken");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer federated");
      return Response.json({ accessToken: "service-account", expireTime: new Date(Date.now() + 3_600_000).toISOString() });
    });
    const request = new Request("https://pace-yourself.com/api", { headers: { "x-vercel-oidc-token": "vercel-oidc" } });

    expect(await getGoogleAccessToken(config, request, fetcher as typeof fetch)).toBe("service-account");
    // Cached for the next call.
    expect(await getGoogleAccessToken(config, request, fetcher as typeof fetch)).toBe("service-account");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("explains a missing OIDC token", async () => {
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    await expect(getGoogleAccessToken(config, new Request("https://pace-yourself.com/api"), vi.fn() as typeof fetch))
      .rejects.toBeInstanceOf(VideoRenderSetupError);
    vi.unstubAllEnvs();
  });
});

describe("signed storage URLs", () => {
  it("builds a V4 URL signed through IAM signBlob", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const stringToSign = Buffer.from(JSON.parse(String(init?.body)).payload, "base64").toString();
      expect(stringToSign.split("\n").slice(0, 3)).toEqual([
        "GOOG4-RSA-SHA256",
        "20261104T120000Z",
        "20261104/auto/storage/goog4_request",
      ]);
      return Response.json({ signedBlob: Buffer.from([0xab, 0xcd]).toString("base64") });
    });

    const url = new URL(await signStorageUrl({
      config,
      accessToken: "service-account",
      method: "GET",
      objectName: `jobs/${jobId}/reel.mp4`,
      expiresSeconds: 3_600,
      responseDisposition: 'attachment; filename="trail-reel.mp4"',
      now: new Date(Date.UTC(2026, 10, 4, 12)),
      fetcher: fetcher as typeof fetch,
    }));

    expect(url.origin + url.pathname).toBe(`https://storage.googleapis.com/renders-bucket/jobs/${jobId}/reel.mp4`);
    expect(url.searchParams.get("X-Goog-Credential")).toBe(`${config.serviceAccountEmail}/20261104/auto/storage/goog4_request`);
    expect(url.searchParams.get("X-Goog-Expires")).toBe("3600");
    expect(url.searchParams.get("response-content-disposition")).toBe('attachment; filename="trail-reel.mp4"');
    expect(url.searchParams.get("X-Goog-Signature")).toBe("abcd");
    expect(String(fetcher.mock.calls[0][0])).toContain(":signBlob");
  });
});

describe("Cloud Run job", () => {
  it("runs one execution with the render page URL as its only input", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        overrides: { containerOverrides: [{ env: [{ name: "RENDER_URL", value: "https://pace-yourself.com/render/video/x#token=t" }] }] },
      });
      return Response.json({ name: "operations/1", metadata: { name: "projects/p/locations/r/jobs/video-render/executions/video-render-abc" } });
    });

    const execution = await runRenderJob(config, "service-account", "https://pace-yourself.com/render/video/x#token=t", fetcher as typeof fetch);

    expect(String(fetcher.mock.calls[0][0])).toBe("https://run.googleapis.com/v2/projects/flowing-lead-513714-t2/locations/europe-west1/jobs/video-render:run");
    expect(execution).toBe("projects/p/locations/r/jobs/video-render/executions/video-render-abc");
  });
});

it("names the reel file after the race", () => {
  expect(getReelFileName("Trail des Druides 2026")).toBe("trail-des-druides-2026-reel.mp4");
});

describe("isRenderJobStale", () => {
  const start = Date.parse("2026-11-05T10:00:00Z");
  const minutes = (count: number) => start + count * 60_000;
  const row = (status: "queued" | "running" | "done", updatedAt: number) => ({
    status,
    created_at: new Date(start).toISOString(),
    updated_at: new Date(updatedAt).toISOString(),
  });

  it("keeps a long render alive while it keeps reporting", () => {
    expect(isRenderJobStale(row("running", minutes(239)), minutes(240))).toBe(false);
  });

  it("marks a render lost after 15 minutes without news", () => {
    expect(isRenderJobStale(row("running", minutes(30)), minutes(46))).toBe(true);
  });

  it("waits for the overall limit on a job still queued", () => {
    expect(isRenderJobStale(row("queued", start), minutes(60))).toBe(false);
    expect(isRenderJobStale(row("queued", start), minutes(9 * 60 + 1))).toBe(true);
  });

  it("never touches a finished job", () => {
    expect(isRenderJobStale(row("done", start), minutes(24 * 60))).toBe(false);
  });
});
