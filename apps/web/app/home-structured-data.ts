import { SITE_URL } from "./seo";

export const buildHomeStructuredData = () => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Pace Yourself",
      url: SITE_URL,
      logo: new URL("/branding/logo-icon-v2.png", SITE_URL).toString(),
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Pace Yourself",
      url: SITE_URL,
      inLanguage: "fr-FR",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
});
