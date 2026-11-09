import { describe, expect, it } from "vitest";

import { ORGANIZER_FEATURES, calculateOrganizerInvoiceAmounts, giftableOrganizerFeatures } from "./organizer-features";

describe("organizer giftable features", () => {
  it("exposes all higher-tier features dynamically", () => {
    expect(giftableOrganizerFeatures("essential")).toHaveLength(14);
    expect(giftableOrganizerFeatures("complete").map((feature) => feature.minimumTier)).toEqual(Array(6).fill("signature"));
    expect(giftableOrganizerFeatures("signature")).toEqual([]);
  });

  it("keeps the fourteen features free of standalone prices", () => {
    expect(ORGANIZER_FEATURES).toHaveLength(14);
    expect(ORGANIZER_FEATURES.every((feature) => !("defaultPriceCents" in feature))).toBe(true);
  });

  it("calculates original value and discount from the pack only", () => {
    expect(calculateOrganizerInvoiceAmounts({ packCatalogCents: 9_900, packNetCents: 5_000 })).toEqual({
      originalSubtotal: 9_900,
      discountTotal: 4_900,
      netTotal: 5_000,
    });
  });
});
