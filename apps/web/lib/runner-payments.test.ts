import { describe, expect, it } from "vitest";
import { canClaimUnlock, chargeColumns, currencyMinorFactor, findVerifiedCoursePurchase, newerChargeFilter, storeChargeFromMajorUnits, stripeCharge } from "./runner-payments";

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

describe("runner sale charges", () => {
  it("converts a store price to minor units only when the provider sent one", () => {
    expect(storeChargeFromMajorUnits({ price: 9.99, currency: "eur", takehomeRate: 0.85, taxRate: 0.1662 })).toEqual({ amountMinor: 999, currency: "EUR", takehomeRate: 0.85, taxRate: 0.1662 });
    expect(storeChargeFromMajorUnits({ price: 9.99, currency: "EUR", takehomeRate: 2, taxRate: 1 })).toMatchObject({ takehomeRate: null, taxRate: null });
    expect(storeChargeFromMajorUnits({ price: null, currency: "EUR" })).toBeNull();
    expect(storeChargeFromMajorUnits({ price: 9.99, currency: "euro" })).toBeNull();
    expect(storeChargeFromMajorUnits({ price: Number.NaN, currency: "EUR" })).toBeNull();
  });

  it("reads Stripe minor units as they are", () => {
    expect(stripeCharge(2999, "eur")).toEqual({ amountMinor: 2999, currency: "EUR", takehomeRate: null, taxRate: null });
    expect(stripeCharge(0, "eur")).toBeNull();
    expect(stripeCharge(0, "eur", { allowZero: true })).toMatchObject({ amountMinor: 0 });
    expect(stripeCharge(12.5, "eur")).toBeNull();
    expect(stripeCharge(undefined, "eur")).toBeNull();
  });

  it("knows zero- and three-decimal currencies", () => {
    expect(currencyMinorFactor("jpy")).toBe(1);
    expect(currencyMinorFactor("KWD")).toBe(1000);
    expect(currencyMinorFactor("EUR")).toBe(100);
  });

  it("maps a charge to ledger columns and guards older renewals", () => {
    expect(chargeColumns(null)).toEqual({ amount_minor: null, currency: null, store_takehome_rate: null, store_tax_rate: null });
    expect(newerChargeFilter("2026-11-23T10:00:00.000Z")).toBe("or=(last_charged_at.is.null,last_charged_at.lte.2026-11-23T10%3A00%3A00.000Z)");
  });
});
