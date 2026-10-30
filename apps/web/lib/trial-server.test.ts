import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureTrialStatus } from "./trial-server";

afterEach(() => vi.unstubAllGlobals());

describe("historical trial status", () => {
  it.each([{ rows: [] }, { rows: [{ trial_started_at: null, trial_ends_at: null }] }])("does not grant or repair an absent trial", async ({ rows }) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(rows)));
    vi.stubGlobal("fetch", fetchMock);
    expect(await ensureTrialStatus({ supabaseUrl: "https://db.example", supabaseKey: "anon", token: "token", userId: "user" }))
      .toEqual({ trialStartedAt: null, trialEndsAt: null, trialWelcomeSeenAt: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
  });

  it("preserves an existing trial without extending it", async () => {
    const row = { trial_started_at: "2026-10-25T00:00:00Z", trial_ends_at: "2026-11-09T00:00:00Z" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([row])));
    vi.stubGlobal("fetch", fetchMock);
    const result = await ensureTrialStatus({ supabaseUrl: "https://db.example", supabaseKey: "anon", token: "token", userId: "user" });
    expect(result.trialEndsAt).toBe(row.trial_ends_at);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
