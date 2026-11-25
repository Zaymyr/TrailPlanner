import { ORGANIZER_TIER_LABEL, ORGANIZER_TIER_PRICE_EUR } from "../../lib/organizer-modules";
import { SITE_URL } from "../seo";

const TIERS = ["essential", "complete", "signature"] as const;

/** Service + per-edition offers of the organizer livret, priced from the tier catalog (HT). */
export const buildOrganizerStructuredData = (canonicalPath: string, description: string) => {
  const url = new URL(canonicalPath, SITE_URL).toString();
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: "Livret coureur et Livret supporter",
    serviceType: "Application mobile d’informations de course pour organisateurs d’événements",
    description,
    url,
    areaServed: "FR",
    provider: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Pace Yourself", url: SITE_URL },
    offers: TIERS.map((tier) => ({
      "@type": "Offer",
      name: `Formule ${ORGANIZER_TIER_LABEL[tier]}`,
      price: ORGANIZER_TIER_PRICE_EUR[tier].toFixed(2),
      priceCurrency: "EUR",
      // Organizer prices are quoted per edition, excluding VAT.
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: ORGANIZER_TIER_PRICE_EUR[tier].toFixed(2),
        priceCurrency: "EUR",
        valueAddedTaxIncluded: false,
        unitText: "édition",
      },
      url,
    })),
  };
};
