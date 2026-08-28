import { describe, expect, it } from "vitest";

import { localeToLanguageTag, localeToOgLocale } from "./seo";

describe("SEO locale formats", () => {
  it("uses the expected formats for Open Graph and hreflang", () => {
    expect(localeToOgLocale("fr")).toBe("fr_FR");
    expect(localeToLanguageTag("fr")).toBe("fr-FR");
    expect(localeToOgLocale("en")).toBe("en_US");
    expect(localeToLanguageTag("en")).toBe("en-US");
  });
});
