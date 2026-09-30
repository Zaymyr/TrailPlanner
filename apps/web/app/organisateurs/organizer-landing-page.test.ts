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
    expect(source).toContain("Preuve terrain");
    expect(source).toContain("featuredProof.uniqueReaders");
  });

  it("keeps the hero demo on-page and the production Android CTA in the full demo", () => {
    expect(source).toContain("https://play.google.com/store/apps/details?id=com.paceyourself.app");
    expect(source).toContain('href="#exemple-tst"');
    expect(source).toContain("Voir la démo du Livret");
    expect(source).toContain("Télécharger l’app et voir TST");
    expect(source).toContain("Une seule source d’information pour vos coureurs");
  });

  it("uses an optimized, controllable hero video with a static poster", () => {
    expect(source).toContain("/landing/organisateurs/racebook-demo.mp4");
    expect(source).toContain("/landing/organisateurs/racebook-demo-poster.webp");
    expect(source).toContain("playsInline");
    expect(source).toContain("Mettre en pause la démonstration");
    expect(source).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(source).not.toContain("Tout au même endroit");
    expect(source).not.toContain("Consultable sur mobile");
  });

  it("keeps the hero and information grid compact across short and narrow viewports", () => {
    expect(source).toContain("md:grid-cols-[minmax(0,1.15fr)_minmax(240px,0.75fr)]");
    expect(source).toContain("lg:max-w-[clamp(240px,calc(40svh-56px),290px)]");
    expect(source).toContain("lg:text-[clamp(2.65rem,4vw,3.4rem)]");
    expect(source).toContain("sm:flex-row md:flex-col md:items-start lg:flex-row");
    expect(source).toContain('<ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">');
    expect(source).toContain("snap-x snap-mandatory overflow-x-auto");
  });

  it("explains the complete path to the Trail TST Livret coureur", () => {
    expect(source).toContain("Dans l’onglet Courses, utilisez la recherche et ouvrez la fiche Trail TST.");
    expect(source).toContain("Choisissez l’un des trois formats");
    expect(source).toContain("appuyez sur « Livret coureur »");
  });
});
