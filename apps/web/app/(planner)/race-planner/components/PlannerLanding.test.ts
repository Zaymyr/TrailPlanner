import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlannerLanding } from "./PlannerLanding";

describe("PlannerLanding", () => {
  const html = renderToStaticMarkup(createElement(PlannerLanding, { onBrowseRaces: () => {}, onImportGpx: () => {} }));

  it("renders the hero actions and the illustrative example", () => {
    expect(html).toContain("Choisir ma course");
    expect(html).toContain("fichier GPX");
    expect(html).toContain("Exemple");
  });

  it("links to the premium and methodology pages", () => {
    expect(html).toContain('href="/premium"');
    expect(html).toContain('href="/methodologie"');
  });
});
