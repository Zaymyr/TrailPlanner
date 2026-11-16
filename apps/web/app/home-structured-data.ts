import { ANDROID_APP_STORE_URL, PUBLIC_IOS_APP_STORE_URL } from "../lib/app-store";
import { SITE_URL } from "./seo";

const BRAND_DESCRIPTION =
  "Pace Yourself publie le Livret coureur et le Livret supporter officiels des courses de trail, avec un catalogue de courses, une estimation de temps gratuite et un plan de course nutrition.";

export const buildHomeStructuredData = () => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Pace Yourself",
      url: SITE_URL,
      logo: new URL("/branding/logo-icon-v2.png", SITE_URL).toString(),
      description: BRAND_DESCRIPTION,
      sameAs: [ANDROID_APP_STORE_URL, PUBLIC_IOS_APP_STORE_URL],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Pace Yourself",
      url: SITE_URL,
      inLanguage: "fr-FR",
      description: BRAND_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "MobileApplication",
      "@id": `${SITE_URL}/#app`,
      name: "Pace Yourself",
      operatingSystem: "Android, iOS",
      applicationCategory: "SportsApplication",
      description: "Livret coureur officiel de ta course, Livret supporter pour tes proches, temps estimé et plan ravito pour le trail.",
      installUrl: [ANDROID_APP_STORE_URL, PUBLIC_IOS_APP_STORE_URL],
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
});
