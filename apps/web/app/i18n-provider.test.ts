import { describe, expect, it } from "vitest";

import { getPathLocale, resolveInitialLocale } from "./i18n-provider";

describe("i18n route locale", () => {
  it.each(["/en", "/en/", "/en/partners", "/en/links/"])(
    "forces English for %s",
    (pathname) => {
      expect(getPathLocale(pathname)).toBe("en");
      expect(resolveInitialLocale(pathname, "fr")).toBe("en");
    },
  );

  it.each(["/partenaires", "/partenaires/", "/links"])(
    "forces French for the French localized route %s",
    (pathname) => {
      expect(getPathLocale(pathname)).toBe("fr");
      expect(resolveInitialLocale(pathname, "en")).toBe("fr");
    },
  );

  it("does not mistake a similarly prefixed route for the English subtree", () => {
    expect(getPathLocale("/english/partners")).toBeUndefined();
  });

  it("keeps the stored preference on routes without a path locale", () => {
    expect(resolveInitialLocale("/race-planner", "en")).toBe("en");
    expect(resolveInitialLocale("/race-planner", "fr")).toBe("fr");
  });

  it("defaults to French when neither the route nor storage defines a locale", () => {
    expect(resolveInitialLocale("/race-planner", null)).toBe("fr");
    expect(resolveInitialLocale("/race-planner", "de")).toBe("fr");
  });
});
