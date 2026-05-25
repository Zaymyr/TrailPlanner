import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { postStripeFormMock, checkRateLimitAsyncMock } = vi.hoisted(() => ({
  postStripeFormMock: vi.fn(),
  checkRateLimitAsyncMock: vi.fn(() => Promise.resolve({ allowed: true, remaining: 5 })),
}));

import { POST } from "./route";

describe("POST /api/stripe/checkout", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("rejects anonymous accounts before creating a Stripe checkout session", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/stripe/checkout", {
        method: "POST",
        headers: {
          authorization: "Bearer guest-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      message: "Guest accounts must create a full account before subscribing.",
    });
    expect(checkRateLimitAsyncMock).not.toHaveBeenCalled();
    expect(postStripeFormMock).not.toHaveBeenCalled();
  });
});

vi.mock("../../../../lib/http", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../../lib/http")>();
  return {
    ...original,
    checkRateLimitAsync: checkRateLimitAsyncMock,
  };
});

vi.mock("../../../../lib/stripe", () => ({
  getStripeConfig: () => ({
    secretKey: "sk_test_123",
    priceId: "price_123",
  }),
  postStripeForm: postStripeFormMock,
}));

vi.mock("../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => ({
    supabaseUrl: "https://supabase.example",
    supabaseAnonKey: "anon-key",
  }),
  getSupabaseServiceConfig: () => ({
    supabaseUrl: "https://supabase.example",
    supabaseServiceRoleKey: "service-role-key",
  }),
  extractBearerToken: () => "guest-token",
  fetchSupabaseUser: () =>
    Promise.resolve({
      id: "guest-user-id",
      email: "guest@example.com",
      isAnonymous: true,
      appMetadata: { provider: "anonymous" },
    }),
  isAnonymousUser: (user: { isAnonymous?: boolean; appMetadata?: { provider?: string } } | null | undefined) =>
    user?.isAnonymous === true || user?.appMetadata?.provider === "anonymous",
}));
