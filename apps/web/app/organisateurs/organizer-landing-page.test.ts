import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/organisateurs/organizer-landing-page.tsx"), "utf8");

describe("organizer landing TST discovery", () => {
  it("renders published RaceBook proof with explicitly estimated readers", () => {
    expect(source).toContain("Ils l’ont utilisé en course");
    expect(source).toContain("Usage mesuré");
    expect(source).toContain("lecteurs uniques estimés");
    expect(source).toContain('<dl className="grid grid-cols-2 gap-3">');
    expect(source).toContain("bg-gradient-to-br from-brand-surface");
    expect(source).toContain("socialProofs.map");
  });

  it("sends the secondary CTA to the production Android app", () => {
    expect(source).toContain("https://play.google.com/store/apps/details?id=com.paceyourself.app");
    expect(source).toContain("Télécharger l’app et voir TST");
    expect(source).not.toContain("Voir un exemple complet");
  });

  it("explains the complete path to the Trail TST Livret coureur", () => {
    expect(source).toContain("Dans l’onglet Courses, utilisez la recherche et ouvrez la fiche Trail TST.");
    expect(source).toContain("Choisissez l’un des trois formats");
    expect(source).toContain("appuyez sur « Livret coureur »");
  });
});
