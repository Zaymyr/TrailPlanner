import { describe, expect, it } from "vitest";

import { extractRevenueCatCharge, extractRevenueCatWebhookUserIds } from "./revenuecat";

/** Shape of a production RevenueCat course purchase webhook (identifiers anonymised). */
const appStoreCoursePurchase = {
  api_version: "1.0",
  event: {
    aliases: ["0c88781b-8e90-4d54-8198-ae0d03cdc64e"],
    app_id: "app_example",
    app_user_id: "0c88781b-8e90-4d54-8198-ae0d03cdc64e",
    commission_percentage: 0.2167,
    country_code: "FR",
    currency: "EUR",
    entitlement_id: null,
    entitlement_ids: null,
    environment: "PRODUCTION",
    event_timestamp_ms: 1819865415000,
    expiration_at_ms: null,
    id: "5B0E3F4A-0000-4000-8000-000000000001",
    is_family_share: false,
    offer_code: null,
    original_app_user_id: "0c88781b-8e90-4d54-8198-ae0d03cdc64e",
    original_transaction_id: "520003105517898",
    period_type: "NORMAL",
    presented_offering_id: "default",
    price: 11.135,
    price_in_purchased_currency: 9.99,
    product_id: "course_unlock",
    purchased_at_ms: 1819865414000,
    renewal_number: null,
    store: "APP_STORE",
    subscriber_attributes: {},
    takehome_percentage: 0.74,
    tax_percentage: 0.1667,
    transaction_id: "520003105517898",
    type: "NON_RENEWING_PURCHASE",
  },
};

describe("extractRevenueCatCharge", () => {
  it("reads the TTC price in the purchase currency and the store rates", () => {
    expect(extractRevenueCatCharge(appStoreCoursePurchase)).toEqual({ amountMinor: 999, currency: "EUR", takehomeRate: 0.74, taxRate: 0.1667 });
  });

  it("keeps the charge of renewals and initial purchases, never of other events", () => {
    const renewal = { event: { ...appStoreCoursePurchase.event, type: "RENEWAL", price_in_purchased_currency: 29.99, takehome_percentage: 0.85 } };
    expect(extractRevenueCatCharge(renewal)).toMatchObject({ amountMinor: 2999, takehomeRate: 0.85 });
    expect(extractRevenueCatCharge({ event: { ...appStoreCoursePurchase.event, type: "INITIAL_PURCHASE" } })).toMatchObject({ amountMinor: 999 });
    for (const type of ["CANCELLATION", "EXPIRATION", "PRODUCT_CHANGE", "REFUND_REVERSED", "BILLING_ISSUE"]) {
      expect(extractRevenueCatCharge({ event: { ...appStoreCoursePurchase.event, type } })).toBeNull();
    }
  });

  it("never invents an amount and tolerates odd fields", () => {
    const { price_in_purchased_currency: _price, ...withoutPrice } = appStoreCoursePurchase.event;
    expect(extractRevenueCatCharge({ event: withoutPrice })).toBeNull();
    expect(extractRevenueCatCharge({ event: { ...appStoreCoursePurchase.event, currency: null } })).toBeNull();
    expect(extractRevenueCatCharge({ event: { ...appStoreCoursePurchase.event, price_in_purchased_currency: 0, period_type: "TRIAL" } })).toBeNull();
    expect(extractRevenueCatCharge({ event: { ...appStoreCoursePurchase.event, price_in_purchased_currency: -9.99 } })).toBeNull();
    // A malformed rate is dropped, not fatal; a malformed price drops only the charge.
    expect(extractRevenueCatCharge({ event: { ...appStoreCoursePurchase.event, tax_percentage: "17%" } })).toMatchObject({ amountMinor: 999, taxRate: null });
    expect(extractRevenueCatCharge({ event: { ...appStoreCoursePurchase.event, price_in_purchased_currency: "9.99" } })).toBeNull();
    expect(extractRevenueCatWebhookUserIds({ event: { ...appStoreCoursePurchase.event, price_in_purchased_currency: "9.99" } }).userIds)
      .toEqual(["0c88781b-8e90-4d54-8198-ae0d03cdc64e"]);
  });

  it("converts to the currency's own minor unit", () => {
    expect(extractRevenueCatCharge({ event: { ...appStoreCoursePurchase.event, currency: "jpy", price_in_purchased_currency: 1500 } })).toMatchObject({ amountMinor: 1500, currency: "JPY" });
    expect(extractRevenueCatCharge({ event: { ...appStoreCoursePurchase.event, currency: "USD", price_in_purchased_currency: 10.99 } })).toMatchObject({ amountMinor: 1099 });
    expect(extractRevenueCatCharge({ event: { ...appStoreCoursePurchase.event, currency: "KWD", price_in_purchased_currency: 3.25 } })).toMatchObject({ amountMinor: 3250 });
  });
});
