import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ secret: null as string | null, synced: true }));
const syncMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ userIds: ["user"], results: [{ synced: state.synced }] })));

import { POST } from "./route";

const request = (authorization?: string) => new Request("https://example.test/api/revenuecat/webhook", {
  method: "POST",
  headers: authorization ? { Authorization: authorization } : undefined,
  body: JSON.stringify({ event: { id: "evt" } }),
});

describe("RevenueCat webhook authorization", () => {
  afterEach(() => {
    state.secret = null;
    state.synced = true;
    syncMock.mockClear();
  });

  it("fails closed when the webhook secret is absent", async () => {
    expect((await POST(request())).status).toBe(503);
    expect(syncMock).not.toHaveBeenCalled();
  });

  it("rejects a forged authorization value", async () => {
    state.secret = "expected-secret";
    expect((await POST(request("Bearer forged-secret"))).status).toBe(401);
    expect(syncMock).not.toHaveBeenCalled();
  });

  it("asks RevenueCat to retry when persistence is incomplete", async () => {
    state.secret = "expected-secret";
    state.synced = false;
    expect((await POST(request("Bearer expected-secret"))).status).toBe(503);
  });

  it("accepts a correctly authorized and persisted event", async () => {
    state.secret = "expected-secret";
    expect((await POST(request("Bearer expected-secret"))).status).toBe(200);
  });
});

vi.mock("../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../lib/revenuecat", () => ({
  getRevenueCatWebhookAuthorization: () => state.secret,
  syncRevenueCatWebhookPayload: syncMock,
}));
