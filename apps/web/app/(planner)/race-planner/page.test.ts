import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { metadata } from "./page";
import { plannerFallback, plannerStructuredData } from "./planner-seo";

describe("race planner server SEO", () => {
  it("renders useful initial content with one heading", () => {
    const html = renderToStaticMarkup(plannerFallback);

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Planifiez votre nutrition et votre allure de trail");
    expect(html).toContain("Importez votre trace GPX");
  });

  it("defines valid SoftwareApplication structured data", () => {
    expect(plannerStructuredData).toMatchObject({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      url: "https://pace-yourself.com/race-planner",
      offers: { price: 0, priceCurrency: "EUR" },
    });
  });

  it("publishes social images", () => {
    expect(metadata.openGraph).toEqual(expect.objectContaining({
      images: [expect.objectContaining({ url: "/landing/secondary.png" })],
    }));
    expect(metadata.twitter).toEqual(expect.objectContaining({
      images: ["/landing/secondary.png"],
    }));
  });
});
