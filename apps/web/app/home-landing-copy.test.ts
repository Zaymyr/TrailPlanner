import { describe, expect, it } from "vitest";

import { en } from "../locales/en";
import { fr } from "../locales/fr";
import { getHomeLandingCopy } from "../components/landing/home-copy";

describe("home landing copy", () => {
  const copy = getHomeLandingCopy("fr", fr.landing);

  it("promises official race info plus a personal plan, for running events in general", () => {
    expect(copy.hero.heading).toContain("infos officielles");
    expect(copy.hero.heading).toContain("plan perso");
    expect(copy.hero.subheading).toMatch(/route/);
    expect(copy.hero.heading).not.toMatch(/trail/i);
  });

  it("describes the Livret coureur in how it works", () => {
    expect(copy.howItWorks.steps).toHaveLength(3);
    expect(copy.howItWorks.steps[0].title).toContain("Livret coureur");
  });

  it("uses tu and the current runner prices in the FAQ", () => {
    const text = copy.faq.items.map((item) => `${item.question} ${item.answer}`).join(" ");
    expect(text).not.toMatch(/Indiquez|Ajustez|Ajoutez|Exportez/);
    expect(text).toContain("9,99 €");
    expect(text).toContain("29,99 €");
    expect(text).not.toContain("offre annuelle");
    expect(copy.faq.ctaEyebrow).not.toBe(copy.faq.title);
  });

  it("keeps the English home copy aligned", () => {
    const english = getHomeLandingCopy("en", en.landing);
    expect(english.hero.runnerLabel).toBe("I am a runner");
    expect(english.faq.items).toHaveLength(en.landing.faq.items.length);
  });
});
