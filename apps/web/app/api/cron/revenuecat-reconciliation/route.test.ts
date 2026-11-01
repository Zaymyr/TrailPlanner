import { afterEach, describe, expect, it, vi } from "vitest";

const reconcile = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/revenuecat-reconciliation", () => ({
  reconcileRevenueCatSubscriptions: reconcile,
}));

import { GET } from "./route";

describe("RevenueCat reconciliation cron", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    reconcile.mockReset();
  });

  it("rejects requests without the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    const response = await GET(new Request("https://example.test/api/cron/revenuecat-reconciliation"));
    expect(response.status).toBe(401);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("returns reconciliation counts to an authorized scheduler", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    reconcile.mockResolvedValue({ scanned: 4, synced: 4, unchanged: 0, failed: 0 });
    const response = await GET(new Request("https://example.test/api/cron/revenuecat-reconciliation", {
      headers: { authorization: "Bearer secret" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: { scanned: 4, synced: 4, unchanged: 0, failed: 0 },
    });
  });
});
