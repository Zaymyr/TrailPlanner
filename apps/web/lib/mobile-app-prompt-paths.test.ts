import { describe, expect, it } from "vitest";

import { isMobileAppPromptHiddenPath } from "../components/mobile-app-prompt-paths";

describe("isMobileAppPromptHiddenPath", () => {
  it.each([
    "/livret-coureur",
    "/livret-supporter",
    "/courses/trail-tst",
    "/courses/trail-tst/supporter-guide",
    "/carte-visite",
    "/demo",
    "/demo/tst",
    "/links",
  ])("hides on %s", (path) => {
    expect(isMobileAppPromptHiddenPath(path)).toBe(true);
  });

  it.each(["/", "/blog/nutrition-trail", "/livret-coureurs-extra", "/a-propos"])("allows on %s", (path) => {
    expect(isMobileAppPromptHiddenPath(path)).toBe(false);
  });
});
