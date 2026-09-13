import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("runner and organizer routing", () => {
  it("offers both audiences explicit destinations in the homepage hero", () => {
    const source = readSource("components/landing/HeroSection.tsx");

    expect(source).toContain('href="/race-planner"');
    expect(source).toContain('href="/organisateurs"');
    expect(source).toContain("Je suis coureur");
    expect(source).toContain("Je suis organisateur");
  });

  it("labels organizer navigation without confusing it with a runner race list", () => {
    const tabs = readSource("app/header-tabs.tsx");
    const menu = readSource("app/header-menu.tsx");

    expect(tabs).toContain("Espace organisateur");
    expect(menu).toContain("Espace organisateur");
    expect(tabs).not.toContain('"Mes courses"');
    expect(menu).not.toContain('"Mes courses"');
  });

  it("redirects organizers away from private race creation", () => {
    const selector = readSource("components/race-planner/RaceSelector.tsx");

    expect(selector).toContain("Vous représentez l’organisation de cette course");
    expect(selector).toContain('href="/organisateurs"');
    expect(selector).toContain("Course personnelle");
  });

  it("uses event terminology on the organizer creation page", () => {
    const source = readSource("app/organizers/page.tsx");

    expect(source).toContain("Créer mon événement");
    expect(source).not.toContain("Ajouter une course");
  });
});
