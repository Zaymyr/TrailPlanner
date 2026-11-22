import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const source = readSource("app/organisateurs/organizer-landing-page.tsx");
const mockupSource = readSource("components/landing/RaceBookPhoneMockup.tsx");

describe("organizer landing TST discovery", () => {
  it("renders published RaceBook proof with explicitly estimated readers", () => {
    expect(source).toContain("Ils l’ont utilisé en course");
    expect(source).toContain("Usage mesuré");
    expect(source).toContain("lecteurs uniques estimés");
    expect(source).toContain("socialProofs.map");
    expect(source).toContain("featuredProof.uniqueReaders");
  });

  it("leads the social proof with the race logo and testimonial, keeping metrics compact", () => {
    expect(source).toContain('id="preuve-sociale"');
    expect(source).toContain('href="#preuve-sociale"');
    expect(source).toContain("<ProofLogo proof={featuredProof}");
    expect(source).toContain("<ProofLogo proof={proof}");
    expect(source).toContain("text-xl font-medium leading-relaxed text-foreground sm:text-2xl");
    expect(source).not.toContain("text-4xl font-semibold tracking-[-0.04em]");
    expect(source).not.toContain("sm:text-5xl");
  });

  it("keeps the hero demo on-page and the production Android CTA in the full demo", () => {
    expect(source).toContain("ANDROID_APP_STORE_URL");
    expect(readSource("lib/app-store.ts")).toContain("https://play.google.com/store/apps/details?id=com.paceyourself.app");
    expect(source).toContain('href="#exemple-tst"');
    expect(source).toContain("Voir la démo du Livret");
    expect(source).toContain("Télécharger l’app et voir TST");
    expect(source).toContain("Une seule source d’information pour vos coureurs");
    expect(source).toContain("Livret coureur + Livret supporter");
    expect(source).toContain("Lien web et QR code, sans compte");
  });

  it("uses an optimized, controllable hero video with a static poster", () => {
    expect(source).toContain("<RaceBookPhoneMockup");
    expect(mockupSource).toContain("/landing/organisateurs/racebook-demo.mp4");
    expect(mockupSource).toContain("/landing/organisateurs/racebook-demo-poster.webp");
    expect(mockupSource).toContain("playsInline");
    expect(mockupSource).toContain("Mettre en pause la démonstration");
    expect(mockupSource).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(source).not.toContain("Tout au même endroit");
    expect(source).not.toContain("Consultable sur mobile");
  });

  it("keeps the hero and information grid compact across short and narrow viewports", () => {
    expect(source).toContain("md:grid-cols-[minmax(0,1.15fr)_minmax(240px,0.75fr)]");
    expect(source).toContain("lg:max-w-[clamp(240px,calc(40svh-56px),290px)]");
    expect(source).toContain("lg:text-[clamp(2.1rem,3.2vw,2.75rem)]");
    expect(source).toContain("sm:flex-row md:flex-col md:items-start lg:flex-row");
    expect(source).toContain('<ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">');
    expect(source).toContain("snap-x snap-mandatory overflow-x-auto");
  });

  it("puts the primary hero CTA right under the subtitle, before the proof card", () => {
    const cta = source.indexOf('primaryCta("hero", "Créer mon Livret coureur")');
    expect(cta).toBeGreaterThan(source.indexOf("Publiez vos informations une fois"));
    expect(cta).toBeLessThan(source.indexOf('href="#preuve-sociale"'));
  });

  it("offers both stores in the app download CTAs", () => {
    expect(source).toContain("PUBLIC_IOS_APP_STORE_URL");
    expect(source).toContain("ANDROID_APP_STORE_URL");
    expect(source).toContain("Télécharger sur {store.name}");
    expect(source).toContain('name: "App Store"');
    expect(source).toContain('name: "Google Play"');
  });

  it("gives every pricing card a CTA, flags Complet as recommended and avoids jargon", () => {
    expect(source).toContain("ORGANIZER_TIER_PRICE_EUR.essential");
    expect(source).toContain("ORGANIZER_TIER_PRICE_EUR.complete");
    expect(source).toContain("ORGANIZER_TIER_PRICE_EUR.signature");
    expect(source).toContain("Prix HT par édition, sans abonnement");
    expect(source).toContain("Recommandé");
    expect(source).not.toContain("le plus choisi");
    expect(source).toContain("Parler de Signature");
    expect(source).toContain('href="#demande-demo"');
    expect(source).toContain("Livret coureur et Livret supporter, l’essentiel");
    expect(source).toContain("Vagues de départ (SAS) et barrières horaires");
    expect(source).toContain("Partenaires et statistiques de clics");
    expect(source).not.toContain("SAS et barrières");
    expect(source).not.toContain("Sponsors et clics");
  });

  it("explains the complete path to the Trail TST Livret coureur", () => {
    expect(source).toContain("Dans l’onglet Courses, utilisez la recherche et ouvrez la fiche Trail TST.");
    expect(source).toContain("Choisissez l’un des trois formats");
    expect(source).toContain("appuyez sur « Livret coureur »");
  });
});
