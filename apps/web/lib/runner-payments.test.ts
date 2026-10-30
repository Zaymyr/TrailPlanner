import { describe, expect, it } from "vitest";
import { canClaimUnlock, findVerifiedCoursePurchase } from "./runner-payments";

describe("runner payment verification", () => {
  it("accepts a matching store transaction created after the intent", () => {
    expect(findVerifiedCoursePurchase({ non_subscriptions: { course: [{ store_transaction_id: "tx-1", purchase_date: "2026-10-30T12:00:00Z" }] } }, "course", "tx-1", "2026-10-30T11:00:00Z")).not.toBeNull();
  });
  it("rejects an old transaction replayed against a new intent", () => {
    expect(findVerifiedCoursePurchase({ non_subscriptions: { course: [{ transaction_identifier: "tx-1", purchase_date: "2026-10-29T12:00:00Z" }] } }, "course", "tx-1", "2026-10-30T11:00:00Z")).toBeNull();
  });
  it("rejects a transaction from another product", () => {
    expect(findVerifiedCoursePurchase({ non_subscriptions: { other: [{ id: "tx-1", purchase_date: "2026-10-30T12:00:00Z" }] } }, "course", "tx-1", "2026-10-30T11:00:00Z")).toBeNull();
  });
  it("rejects a transaction from the wrong store", () => {
    expect(findVerifiedCoursePurchase({ non_subscriptions: { course: [{ id: "tx-1", store: "app_store", purchase_date: "2026-10-30T12:00:00Z" }] } }, "course", "tx-1", "2026-10-30T11:00:00Z", "google")).toBeNull();
  });
  it("accepts official lowercase RevenueCat store values", () => {
    expect(findVerifiedCoursePurchase({ non_subscriptions: { course: [{ id: "tx-1", store: "play_store", purchase_date: "2026-10-30T12:00:00Z" }] } }, "course", "tx-1", "2026-10-30T11:00:00Z", "google")).not.toBeNull();
  });
  it("does not allow an existing claim to move between users or plans", () => {
    expect(canClaimUnlock({ user_id: "u1", plan_id: "p1", status: "active" }, "u2", "p1")).toBe(false);
    expect(canClaimUnlock({ user_id: "u1", plan_id: "p1", status: "active" }, "u1", "p2")).toBe(false);
  });
  it("does not reactivate a refunded claim", () => {
    expect(canClaimUnlock({ user_id: "u1", plan_id: "p1", status: "refunded" }, "u1", "p1")).toBe(false);
  });
  it("allows the first claim only when no transaction exists", () => {
    expect(canClaimUnlock(null, "u1", "p1")).toBe(true);
  });
});
