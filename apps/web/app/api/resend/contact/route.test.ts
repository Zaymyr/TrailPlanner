import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  checkRateLimitAsync: vi.fn(),
  extractBearerToken: vi.fn(),
  fetchSupabaseUser: vi.fn(),
  getSupabaseAnonConfig: vi.fn(),
  syncIdentifiedUserToResendContact: vi.fn(),
}));

const contactRequest = () =>
  new NextRequest("http://localhost/api/resend/contact", {
    method: "POST",
    headers: {
      authorization: "Bearer user-token",
    },
  });

describe("POST /api/resend/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseAnonConfig.mockReturnValue({
      supabaseUrl: "https://supabase.example",
      supabaseAnonKey: "anon-key",
    });
    mocks.extractBearerToken.mockReturnValue("user-token");
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, remaining: 5 });
  });

  it("skips anonymous Supabase users before calling Resend", async () => {
    mocks.fetchSupabaseUser.mockResolvedValue({
      id: "anonymous-user-id",
      email: "guest@example.com",
      isAnonymous: true,
      appMetadata: { provider: "anonymous" },
    });

    const response = await POST(contactRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: "skipped", reason: "anonymous-user" });
    expect(mocks.checkRateLimitAsync).not.toHaveBeenCalled();
    expect(mocks.syncIdentifiedUserToResendContact).not.toHaveBeenCalled();
  });

  it("syncs an identified Supabase user to Resend", async () => {
    const user = {
      id: "identified-user-id",
      email: "ada@example.com",
      appMetadata: { provider: "email" },
      userMetadata: { full_name: "Ada Lovelace" },
    };

    mocks.fetchSupabaseUser.mockResolvedValue(user);
    mocks.syncIdentifiedUserToResendContact.mockResolvedValue({ status: "created", id: "contact-id" });

    const response = await POST(contactRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: "created", id: "contact-id" });
    expect(mocks.checkRateLimitAsync).toHaveBeenCalledWith("resend-contact-sync:identified-user-id", 6, 60_000);
    expect(mocks.syncIdentifiedUserToResendContact).toHaveBeenCalledWith(user);
  });

  it("returns a gateway error when Resend rejects the contact", async () => {
    mocks.fetchSupabaseUser.mockResolvedValue({
      id: "identified-user-id",
      email: "ada@example.com",
      appMetadata: { provider: "email" },
    });
    mocks.syncIdentifiedUserToResendContact.mockResolvedValue({
      status: "failed",
      statusCode: 429,
      message: "Too many requests.",
    });

    const response = await POST(contactRequest());
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toEqual({ message: "Unable to sync Resend contact." });
  });
});

vi.mock("../../../../lib/http", () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../lib/resend", () => ({
  syncIdentifiedUserToResendContact: mocks.syncIdentifiedUserToResendContact,
}));

vi.mock("../../../../lib/supabase", () => ({
  extractBearerToken: mocks.extractBearerToken,
  fetchSupabaseUser: mocks.fetchSupabaseUser,
  getSupabaseAnonConfig: mocks.getSupabaseAnonConfig,
}));
