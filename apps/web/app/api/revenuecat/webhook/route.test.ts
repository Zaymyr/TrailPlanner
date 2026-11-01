import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ secret: null as string | null, signingSecret: null as string | null, synced: true }));
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
    state.signingSecret = null;
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

  it("accepts a recent RevenueCat HMAC signature over the raw payload", async () => {
    state.signingSecret = "signing-secret";
    const body = JSON.stringify({ event: { id: "evt" } });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto.createHmac("sha256", state.signingSecret).update(`${timestamp}.${body}`).digest("hex");
    const response = await POST(new Request("https://example.test/api/revenuecat/webhook", {
      method: "POST",
      headers: { "x-revenuecat-webhook-signature": `t=${timestamp},v1=${signature}` },
      body,
    }));

    expect(response.status).toBe(200);
  });

  it("rejects a stale RevenueCat HMAC signature", async () => {
    state.signingSecret = "signing-secret";
    const body = JSON.stringify({ event: { id: "evt" } });
    const timestamp = (Math.floor(Date.now() / 1000) - 301).toString();
    const signature = crypto.createHmac("sha256", state.signingSecret).update(`${timestamp}.${body}`).digest("hex");
    const response = await POST(new Request("https://example.test/api/revenuecat/webhook", {
      method: "POST",
      headers: { "x-revenuecat-webhook-signature": `t=${timestamp},v1=${signature}` },
      body,
    }));

    expect(response.status).toBe(401);
  });
});

vi.mock("../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../lib/revenuecat", () => ({
  getRevenueCatWebhookAuthorization: () => state.secret,
  getRevenueCatWebhookSigningSecret: () => state.signingSecret,
  syncRevenueCatWebhookPayload: syncMock,
}));
