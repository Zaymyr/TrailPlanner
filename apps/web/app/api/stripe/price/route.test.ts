import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getStripeConfigMock } = vi.hoisted(() => ({
  getStripeConfigMock: vi.fn(),
}));

import { GET } from "./route";

vi.mock("../../../../lib/stripe", () => ({
  getStripeConfig: getStripeConfigMock,
}));

vi.mock("../../../../lib/http", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../../lib/http")>();
  return {
    ...original,
    checkRateLimit: () => ({ allowed: true, remaining: 20 }),
  };
});

describe("GET /api/stripe/price", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getStripeConfigMock.mockReset();
  });

  it("does not fetch the legacy price when the annual runner price is absent", async () => {
    getStripeConfigMock.mockReturnValue({
      secretKey: "sk_test_runner",
      priceId: "price_legacy",
      annualPriceId: undefined,
      coursePriceId: "price_course",
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await GET(new NextRequest("http://localhost/api/stripe/price?offer=annual"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ available: false, price: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
