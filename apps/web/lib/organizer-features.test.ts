import { describe, expect, it } from "vitest";

import { ORGANIZER_FEATURES, calculateOrganizerInvoiceAmounts, giftableOrganizerFeatures } from "./organizer-features";

describe("organizer giftable features", () => {
  it("exposes all higher-tier features dynamically", () => {
    expect(giftableOrganizerFeatures("essential")).toHaveLength(14);
    expect(giftableOrganizerFeatures("complete").map((feature) => feature.minimumTier)).toEqual(Array(6).fill("signature"));
    expect(giftableOrganizerFeatures("signature")).toEqual([]);
  });

  it("keeps seeded feature prices aligned with plan upgrade deltas", () => {
    expect(ORGANIZER_FEATURES.filter((feature) => feature.minimumTier === "complete").reduce((sum, feature) => sum + feature.defaultPriceCents, 0)).toBe(10_000);
    expect(ORGANIZER_FEATURES.filter((feature) => feature.minimumTier === "signature").reduce((sum, feature) => sum + feature.defaultPriceCents, 0)).toBe(15_000);
  });

  it("shows original value and removes every gift from the net total", () => {
    expect(calculateOrganizerInvoiceAmounts({ packCatalogCents: 9_900, packNetCents: 5_000, giftedFeaturePrices: [1_250, 2_500] })).toEqual({
      originalSubtotal: 13_650,
      discountTotal: 8_650,
      netTotal: 5_000,
    });
  });
});
