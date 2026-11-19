import { randomBytes } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { isTokenRefreshDue, refreshInstagramTokenIfDue, toPublicAccount } from "./accounts";
import { decryptSocialToken, encryptSocialToken } from "./crypto";

const supabase = { supabaseUrl: "https://db.example.co", supabaseServiceRoleKey: "service" };
const key = randomBytes(32);
const NOW = new Date("2026-11-19T10:00:00Z");
const DAY = 24 * 60 * 60 * 1_000;

const accountRow = (refreshedDaysAgo: number, overrides: Record<string, unknown> = {}) => ({
  id: "55555555-5555-4555-8555-555555555555",
  platform: "instagram",
  ig_user_id: "1784",
  username: "pace_your.self",
  access_token_encrypted: encryptSocialToken(key, "OLD"),
  token_refreshed_at: new Date(NOW.getTime() - refreshedDaysAgo * DAY).toISOString(),
  token_expires_at: new Date(NOW.getTime() + (60 - refreshedDaysAgo) * DAY).toISOString(),
  status: "connected",
  status_message: null,
  updated_at: NOW.toISOString(),
  ...overrides,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("Instagram token refresh", () => {
  it("is due after 50 days, never before 24 h", () => {
    expect(isTokenRefreshDue(accountRow(51), NOW.getTime())).toBe(true);
    expect(isTokenRefreshDue(accountRow(10), NOW.getTime())).toBe(false);
    expect(isTokenRefreshDue(accountRow(0.5, { token_expires_at: new Date(NOW.getTime() + DAY).toISOString() }), NOW.getTime())).toBe(false);
  });

  it("refreshes a 51-day-old token and stores it encrypted", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json([accountRow(51)]))
      .mockResolvedValueOnce(json({ access_token: "NEW", token_type: "bearer", expires_in: 5_184_000 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await refreshInstagramTokenIfDue({ supabase, key, now: NOW, fetcher });
    expect(result).toEqual({ status: "refreshed", expiresAt: new Date(NOW.getTime() + 60 * DAY).toISOString() });
    expect(String(fetcher.mock.calls[1][0])).toContain("refresh_access_token?grant_type=ig_refresh_token&access_token=OLD");
    const patch = JSON.parse(fetcher.mock.calls[2][1].body);
    expect(patch.access_token_encrypted).not.toContain("NEW");
    expect(decryptSocialToken(key, patch.access_token_encrypted)).toBe("NEW");
    expect(patch.status).toBe("connected");
  });

  it("does nothing when the token is recent", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json([accountRow(5)]));
    expect(await refreshInstagramTokenIfDue({ supabase, key, now: NOW, fetcher })).toEqual({ status: "not_due" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("asks for a reconnect when Meta rejects the token", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json([accountRow(55)]))
      .mockResolvedValueOnce(json({ error: { message: "Session has expired", code: 190 } }, 400))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await refreshInstagramTokenIfDue({ supabase, key, now: NOW, fetcher })).toEqual({ status: "needs_reconnect" });
    expect(JSON.parse(fetcher.mock.calls[2][1].body).status).toBe("needs_reconnect");
  });

  it("never exposes the encrypted token in the public view", () => {
    const view = toPublicAccount(accountRow(1) as never);
    expect(JSON.stringify(view)).not.toContain("v1:");
  });
});
