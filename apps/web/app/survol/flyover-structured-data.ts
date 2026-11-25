import { FLYOVER_OFFERS } from "../../lib/flyover-orders";
import { SITE_URL } from "../seo";

/** Service + the two flyover offers, priced from the order catalog (TTC). */
export const buildFlyoverStructuredData = (canonicalPath: string, description: string) => {
  const url = new URL(canonicalPath, SITE_URL).toString();
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: "Vidéo de survol 3D de parcours",
    serviceType: "Vidéo de survol 3D d’un parcours de course à partir de son GPX",
    description,
    url,
    provider: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Pace Yourself", url: SITE_URL },
    offers: Object.values(FLYOVER_OFFERS).map((offer) => ({
      "@type": "Offer",
      name: offer.label,
      price: (offer.amountCents / 100).toFixed(2),
      priceCurrency: "EUR",
      url,
    })),
  };
};
