import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const consent = vi.hoisted(() => ({ allowed: true }));
vi.mock("./cookies/consent", () => ({ canLoadAnalytics: () => consent.allowed }));

import { clearPendingCheckout, readPendingCheckout, rememberPendingCheckout } from "./checkout-return";

const RACE_ID = "76b11657-f10a-49af-a728-18a58875ac4a";
const PLAN_ID = "11111111-2222-4333-8444-555555555555";

describe("pending runner checkout", () => {
  const storage = new Map<string, string>();
  const originalWindow = globalThis.window;

  beforeEach(() => {
    storage.clear();
    consent.allowed = true;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
          removeItem: (key: string) => storage.delete(key),
        },
      },
    });
  });
  afterEach(() => Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow }));

  it("round-trips the offer, source race and plan id only", () => {
    rememberPendingCheckout({ offer: "course", sourceRace: RACE_ID, planId: PLAN_ID });
    expect(readPendingCheckout()).toEqual({ offer: "course", sourceRace: RACE_ID, planId: PLAN_ID });
    clearPendingCheckout();
    expect(readPendingCheckout()).toBeNull();
  });

  it("drops malformed identifiers and expired entries", () => {
    rememberPendingCheckout({ offer: "annual", sourceRace: "bad", planId: "bad" });
    expect(readPendingCheckout()).toEqual({ offer: "annual", sourceRace: null, planId: null });
    const [key, value] = [...storage.entries()][0];
    storage.set(key, JSON.stringify({ ...JSON.parse(value), expiresAt: Date.now() - 1 }));
    expect(readPendingCheckout()).toBeNull();
  });

  it("stores nothing without analytics consent", () => {
    consent.allowed = false;
    rememberPendingCheckout({ offer: "annual" });
    expect(storage.size).toBe(0);
  });
});
