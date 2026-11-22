import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("runner and organizer routing", () => {
  it("offers both audiences explicit destinations in the homepage hero", () => {
    const source = readSource("components/landing/HeroSection.tsx");

    expect(source).toContain('href="/race-planner"');
    expect(source).toContain('href="/organisateurs"');
    expect(source).toContain("hero.runnerLabel");
    expect(source).toContain("hero.organizerLabel");

    const copy = readSource("components/landing/home-copy.ts");
    expect(copy).toContain("Je suis coureur");
    expect(copy).toContain("Je suis organisateur");
  });

  it("shows the organizer CTA right under the runner CTA, before the bullets and on mobile", () => {
    const source = readSource("components/landing/HeroSection.tsx");

    expect(source.indexOf('href="/organisateurs"')).toBeGreaterThan(source.indexOf('href="/race-planner"'));
    expect(source.indexOf('href="/organisateurs"')).toBeLessThan(source.indexOf("hero.bullets.map"));
    expect(source).not.toContain("sm:hidden");
    expect(source).toContain("<RaceBookPhoneMockup");
  });

  it("speaks to organizers with vous on the event creation page", () => {
    const source = readSource("app/organizers/page.tsx");

    expect(source).toContain("Créez votre événement gratuitement. Vous ne payez qu&apos;à la publication du livret");
    expect(source).toContain("ORGANIZER_TIER_PRICE_EUR.essential");
    expect(source).not.toContain("claim");
    expect(source).not.toContain("brouillon");
    expect(source).not.toMatch(/Crée ton|ton compte|Connecte-toi/);
    expect(source.indexOf("<Button>Créer un compte</Button>")).toBeGreaterThan(-1);
  });

  it("labels organizer navigation without confusing it with a runner race list", () => {
    const tabs = readSource("app/header-tabs.tsx");
    const menu = readSource("app/header-menu.tsx");

    expect(tabs).toContain("Espace organisateur");
    expect(menu).toContain("Espace organisateur");
    expect(tabs).not.toContain('"Mes courses"');
    expect(menu).not.toContain('"Mes courses"');
  });

  it("does not offer runner-owned race creation", () => {
    const selector = readSource("components/race-planner/RaceSelector.tsx");

    expect(selector).not.toContain("Course personnelle");
    expect(selector).not.toContain("Ajouter une course personnelle");
    expect(selector).toContain("Aucune course disponible.");
  });

  it("uses event terminology on the organizer creation page", () => {
    const source = readSource("app/organizers/page.tsx");

    expect(source).toContain("Créer mon événement");
    expect(source).not.toContain("Ajouter une course");
  });
});
