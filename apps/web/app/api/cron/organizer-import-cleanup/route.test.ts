import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cleanup: vi.fn() }));

vi.mock("../../../../lib/organizer-import-sessions", () => ({
  cleanupExpiredOrganizerImportSessions: mocks.cleanup,
}));

import { GET } from "./route";

describe("organizer import cleanup cron", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects requests without the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    const response = await GET(new Request("http://localhost/api/cron/organizer-import-cleanup"));
    expect(response.status).toBe(401);
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });

  it("removes expired sessions behind the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    mocks.cleanup.mockResolvedValue({ scanned: 2, deleted: 2, failed: 0 });
    const response = await GET(
      new Request("http://localhost/api/cron/organizer-import-cleanup", {
        headers: { authorization: "Bearer secret" },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: { scanned: 2, deleted: 2, failed: 0 },
    });
  });
});
