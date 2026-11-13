import { afterEach, describe, expect, it } from "vitest";

import { getStripeConfig } from "./stripe";

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe("getStripeConfig", () => {
  it("does not reuse the legacy Stripe price for the runner annual offer", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_runner";
    process.env.STRIPE_PRICE_ID = "price_legacy";
    delete process.env.STRIPE_ANNUAL_PRICE_ID;

    const config = getStripeConfig();

    expect(config?.priceId).toBe("price_legacy");
    expect(config?.annualPriceId).toBeUndefined();
  });

  it("keeps the explicit annual and course prices separate", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_runner";
    process.env.STRIPE_PRICE_ID = "price_legacy";
    process.env.STRIPE_ANNUAL_PRICE_ID = "price_annual";
    process.env.STRIPE_COURSE_PRICE_ID = "price_course";

    const config = getStripeConfig();

    expect(config?.annualPriceId).toBe("price_annual");
    expect(config?.coursePriceId).toBe("price_course");
  });
});
