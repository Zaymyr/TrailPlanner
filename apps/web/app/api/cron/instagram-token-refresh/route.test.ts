import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("../../../../lib/instagram/accounts", () => ({ refreshInstagramTokenIfDue: mocks.refresh }));

import { GET } from "./route";

const request = (authorization?: string) =>
  new Request("http://localhost/api/cron/instagram-token-refresh", authorization ? { headers: { authorization } } : undefined);

describe("Instagram token refresh cron", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("rejects requests without the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    expect((await GET(request())).status).toBe(401);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("skips quietly when the encryption key is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("SUPABASE_URL", "https://db.example.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY", "");
    const response = await GET(request("Bearer secret"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ result: { status: "not_configured" } });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("refreshes behind the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("SUPABASE_URL", "https://db.example.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY", "a".repeat(64));
    mocks.refresh.mockResolvedValue({ status: "refreshed", expiresAt: "2027-01-18T10:00:00.000Z" });
    const response = await GET(request("Bearer secret"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, result: { status: "refreshed" } });
  });
});
