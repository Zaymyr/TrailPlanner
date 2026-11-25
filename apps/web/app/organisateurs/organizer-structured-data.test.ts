import { describe, expect, it } from "vitest";

import { ORGANIZER_TIER_PRICE_EUR } from "../../lib/organizer-modules";
import { buildFlyoverStructuredData } from "../survol/flyover-structured-data";
import { buildOrganizerStructuredData } from "./organizer-structured-data";

describe("offer structured data", () => {
  it("lists the three organizer tiers per edition, excluding VAT, from the tier catalog", () => {
    const data = buildOrganizerStructuredData("/organisateurs", "Livret coureur.");

    expect(data["@type"]).toBe("Service");
    expect(data.url.endsWith("/organisateurs")).toBe(true);
    expect(data.offers.map((offer) => offer.price)).toEqual([
      ORGANIZER_TIER_PRICE_EUR.essential.toFixed(2),
      ORGANIZER_TIER_PRICE_EUR.complete.toFixed(2),
      ORGANIZER_TIER_PRICE_EUR.signature.toFixed(2),
    ]);
    for (const offer of data.offers) {
      expect(offer.priceCurrency).toBe("EUR");
      expect(offer.priceSpecification.valueAddedTaxIncluded).toBe(false);
    }
  });

  it("lists both flyover offers in euros from the order catalog", () => {
    const data = buildFlyoverStructuredData("/survol", "Vidéo de survol.");

    expect(data["@type"]).toBe("Service");
    expect(data.offers.map((offer) => offer.price)).toEqual(["29.99", "59.99"]);
  });
});
