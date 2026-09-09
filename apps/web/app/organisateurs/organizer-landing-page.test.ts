import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/organisateurs/organizer-landing-page.tsx"), "utf8");

describe("organizer landing TST discovery", () => {
  it("sends the secondary CTA to the production Android app", () => {
    expect(source).toContain("https://play.google.com/store/apps/details?id=com.paceyourself.app");
    expect(source).toContain("Télécharger l’app et voir TST");
    expect(source).not.toContain("Voir un exemple complet");
  });

  it("explains the complete path to the Trail TST RaceBook", () => {
    expect(source).toContain("Dans l’onglet Courses, utilisez la recherche et ouvrez la fiche Trail TST.");
    expect(source).toContain("Choisissez l’un des trois formats");
    expect(source).toContain("appuyez sur « Racebook »");
  });
});
