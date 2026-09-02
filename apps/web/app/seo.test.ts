import { describe, expect, it } from "vitest";

import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, localeToLanguageTag, localeToOgLocale } from "./seo";

describe("SEO locale formats", () => {
  it("uses the expected formats for Open Graph and hreflang", () => {
    expect(localeToOgLocale("fr")).toBe("fr_FR");
    expect(localeToLanguageTag("fr")).toBe("fr-FR");
    expect(localeToOgLocale("en")).toBe("en_US");
    expect(localeToLanguageTag("en")).toBe("en-US");
  });
});

describe("default social preview", () => {
  it("uses an existing planner preview with declared dimensions", () => {
    expect(DEFAULT_SOCIAL_IMAGE_PATH).toBe("/landing/secondary.png");
    expect(DEFAULT_SOCIAL_IMAGE).toEqual(expect.objectContaining({
      url: DEFAULT_SOCIAL_IMAGE_PATH,
      width: 770,
      height: 381,
    }));
  });
});
