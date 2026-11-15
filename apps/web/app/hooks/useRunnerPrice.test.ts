import { describe, expect, it } from "vitest";

import { formatRunnerPricePayload } from "./useRunnerPrice";

describe("formatRunnerPricePayload", () => {
  it("formats the provider amount without substituting a reference price", () => {
    expect(formatRunnerPricePayload({
      available: true,
      price: { currency: "EUR", unitAmount: 1234 },
    }, "fr-FR")).toMatch(/12,34/);
  });

  it("keeps unavailable and invalid provider responses unavailable", () => {
    expect(formatRunnerPricePayload({ available: false, price: null }, "fr-FR")).toBeNull();
    expect(formatRunnerPricePayload({ price: { currency: "EUR" } }, "fr-FR")).toBeNull();
    expect(formatRunnerPricePayload({ price: { currency: "EUR", unitAmount: -1 } }, "fr-FR")).toBeNull();
  });
});
