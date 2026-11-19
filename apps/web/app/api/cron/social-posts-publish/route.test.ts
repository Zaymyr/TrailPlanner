import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ tick: vi.fn(), deps: vi.fn() }));

vi.mock("../../../../lib/instagram/publisher", () => ({ runPublishingTick: mocks.tick }));
vi.mock("../../../../lib/instagram/runtime", () => ({ createPublisherDeps: mocks.deps }));

import { GET } from "./route";

describe("social posts publishing cron", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("rejects requests without the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    const response = await GET(new Request("http://localhost/api/cron/social-posts-publish", { headers: { authorization: "Bearer wrong" } }));
    expect(response.status).toBe(401);
    expect(mocks.tick).not.toHaveBeenCalled();
  });

  it("rejects every request when CRON_SECRET is not set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(new Request("http://localhost/api/cron/social-posts-publish", { headers: { authorization: "Bearer " } }));
    expect(response.status).toBe(401);
  });

  it("runs one publishing tick behind the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("SUPABASE_URL", "https://db.example.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    mocks.deps.mockReturnValue({ dryRun: true });
    mocks.tick.mockResolvedValue({ promoted: 1, processed: [{ id: "p1", outcome: "published" }] });
    const response = await GET(new Request("http://localhost/api/cron/social-posts-publish", { headers: { authorization: "Bearer secret" } }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, promoted: 1 });
    expect(mocks.tick).toHaveBeenCalledWith({ dryRun: true });
  });
});
