import { beforeEach, describe, expect, it, vi } from "vitest";

const checkRateLimitAsync = vi.hoisted(() => vi.fn());

vi.mock("./http", () => ({ checkRateLimitAsync }));

import { AUTH_RATE_LIMITS, enforceAuthRateLimit } from "./auth-rate-limit";

const request = (ip = "203.0.113.7") =>
  new Request("http://localhost/api/auth/signin", { method: "POST", headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });

describe("enforceAuthRateLimit", () => {
  beforeEach(() => checkRateLimitAsync.mockReset());

  it("lets the request through and keys by IP and hashed, normalized email", async () => {
    checkRateLimitAsync.mockResolvedValue({ allowed: true, remaining: 5 });

    expect(await enforceAuthRateLimit(request(), "signin", " Runner@Example.com ")).toBeNull();
    await enforceAuthRateLimit(request(), "signin", "runner@example.com");

    const keys = checkRateLimitAsync.mock.calls.map((call) => call[0] as string);
    expect(keys[0]).toBe("auth-signin-ip:203.0.113.7");
    expect(keys[1]).toMatch(/^auth-signin-email:[0-9a-f]{32}$/);
    expect(keys[1]).not.toContain("runner");
    expect(keys[1]).toBe(keys[3]);
    expect(checkRateLimitAsync).toHaveBeenCalledWith(keys[0], AUTH_RATE_LIMITS.signin.ip.max, AUTH_RATE_LIMITS.signin.ip.windowMs);
  });

  it("returns 429 with Retry-After and a French message when a limit is exceeded", async () => {
    checkRateLimitAsync
      .mockResolvedValueOnce({ allowed: true, remaining: 1 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfter: 42_000 });

    const response = await enforceAuthRateLimit(request(), "signup", "a@b.co");

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("42");
    expect(await response?.json()).toMatchObject({ code: "rate_limited", message: expect.stringContaining("Trop de tentatives") });
  });
});
