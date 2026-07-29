import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildOrganizerWebsiteImportPreview } from "../../../../../../lib/organizer-website-import";

vi.mock("server-only", () => ({}));

const htmlResponse = (html: string) =>
  new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

const gpxResponse = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
      <gpx version="1.1" creator="test">
        <trk><trkseg>
          <trkpt lat="45.0000" lon="6.0000"><ele>1000</ele></trkpt>
          <trkpt lat="45.0100" lon="6.0100"><ele>1100</ele></trkpt>
        </trkseg></trk>
      </gpx>`,
    { status: 200, headers: { "content-type": "application/gpx+xml" } }
  );

describe("buildOrganizerWebsiteImportPreview generic fallback", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses explicit format pages and keeps general-page logistics separate", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);

      if (url === "https://trailfort.example/") {
        return htmlResponse(`
          <html>
            <head>
              <title>Trail du Fort de Tamie</title>
              <meta property="og:site_name" content="Trail du Fort de Tamie" />
            </head>
            <body>
              <p>Dimanche 17 mai 2026</p>
              <p>Materiel obligatoire : couverture de survie, gobelet</p>
              <p>Navette coureurs depuis le parking nord a 7h30</p>
              <p>Depart : Fort de Tamie, Route du Collet de Tamie, 73200 Mercury</p>
              <a href="/hidden-format">Ancienne page de format</a>
            </body>
          </html>
        `);
      }

      if (url === "https://trailfort.example/les-parcours") {
        return htmlResponse(`
          <html>
            <body>
              <h6>L'Abbaye</h6>
              <p>11 km - 500 D+</p>
              <p>Depart 9h30</p>
              <p>Ravitaillement : km7</p>
              <a href="/web/content/abbaye?download=true">Telecharger la trace GPX</a>

              <h6>La Belle Etoile</h6>
              <p>15 km - 1100 D+</p>
              <p>Ravitaillement : km11</p>
              <a href="/web/content/belle-etoile?download=true">Telecharger la trace GPX</a>

              <h6>15 km &amp; 1100 D+ La Belle Etoile</h6>
              <p>15 km - parcours panoramique</p>
              <p>Ravitaillement : km9</p>

              <h6>Les 2 Savoies</h6>
              <p>25 km - 1850 D+</p>
              <p>Ravitaillement : km7, km15</p>
              <a href="/web/content/deux-savoies?download=true">Telecharger la trace GPX</a>
              <p>Fort de Tamie, Route du Collet de Tamie, 73200 Mercury</p>
            </body>
          </html>
        `);
      }

      if (url.startsWith("https://trailfort.example/web/content/")) return gpxResponse();

      throw new Error(`Unexpected URL ${url}`);
    });

    const preview = await buildOrganizerWebsiteImportPreview("https://trailfort.example/", {
      formatUrls: ["https://trailfort.example/les-parcours"],
    });

    expect(preview.source.provider).toBe("generic");
    expect(preview.event.name).toBe("Trail du Fort de Tamie");
    expect(preview.event.raceDate).toBe("2026-05-17");
    expect(preview.event.logistics.mandatoryEquipment).toContain("couverture de survie");
    expect(preview.event.logistics.shuttles).toContain("Navette coureurs");
    expect(preview.event.logistics.startAddress).toContain("Fort de Tamie");
    expect(preview.races).toHaveLength(3);
    expect(preview.races.map((race) => race.name)).toEqual(["L'Abbaye", "La Belle Etoile", "Les 2 Savoies"]);
    expect(preview.races.map((race) => race.distanceKm)).toEqual([11, 15, 25]);
    expect(preview.races.map((race) => race.elevationGainM)).toEqual([500, 1100, 1850]);
    expect(preview.races.every((race) => race.hasReliableGpx)).toBe(true);
    expect(preview.races.every((race) => (race.assessment?.score ?? 0) >= 80)).toBe(true);
    expect(preview.races[0].assessment).toMatchObject({
      reliabilityScore: 100,
      foundCount: 9,
      totalCount: 10,
    });
    expect(preview.races[0].assessment?.findings.find((finding) => finding.key === "gpx")).toMatchObject({
      value: "GPX exploitable",
      confidence: "high",
      sourceLabel: "Trace GPX",
    });
    expect(preview.races.find((race) => race.name === "La Belle Etoile")?.aidStations.map((station) => station.distanceKm)).toEqual([
      9, 11,
    ]);
    expect(preview.races.find((race) => race.name === "Les 2 Savoies")?.aidStations.map((station) => station.distanceKm)).toEqual([
      7, 15,
    ]);
  });

  it("sorts formats from the explicit format page by final score", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://scores.example/") {
        return htmlResponse(`
          <html><head><title>Trail des Scores</title></head><body><p>Dimanche 17 mai 2026</p></body></html>
        `);
      }
      if (url === "https://scores.example/formats") {
        return htmlResponse(`
          <html>
            <head><title>Trail des Scores</title></head>
            <body>
              <p>Dimanche 17 mai 2026</p>
              <h2>Format partiel</h2>
              <p>10 km - trace à confirmer</p>
              <h2>Format complet</h2>
              <p>20 km - 1000 D+</p>
              <a href="/complet.gpx">GPX</a>
            </body>
          </html>
        `);
      }
      if (url === "https://scores.example/complet.gpx") return gpxResponse();
      throw new Error(`Unexpected URL ${url}`);
    });

    const preview = await buildOrganizerWebsiteImportPreview("https://scores.example/", {
      formatUrls: ["https://scores.example/formats"],
    });

    expect(preview.races.map((race) => race.name)).toEqual(["Format complet", "Format partiel"]);
    expect(preview.races[0].assessment?.score).toBeGreaterThan(preview.races[1].assessment?.score ?? 0);
  });

  it("uses the event page date while explicit format pages may contain older editions", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);

      if (url === "https://chouette.example/") {
        return htmlResponse(`
          <html>
            <head>
              <title>Les Foulees Fleurinoises</title>
              <meta property="og:site_name" content="Les Foulees Fleurinoises" />
            </head>
            <body>
              <p>Dimanche 27 septembre 2026</p>
            </body>
          </html>
        `);
      }

      if (url === "https://chouette.example/les-parcours") {
        return htmlResponse(`
          <html>
            <body>
              <p>2 traces pour cette edition 2025</p>
              <p>11 km</p>
              <p>15 km</p>
            </body>
          </html>
        `);
      }

      if (url === "https://chouette.example/reglement") {
        return htmlResponse(`
          <html>
            <body>
              <p>REGLEMENT 2026 : Les Foulees Fleurinoises</p>
              <p>Dimanche 27 septembre 2026, l'association organise la course.</p>
              <p>L'epreuve se dispute sur 2 traces : la « Fleurinoise » d'une longueur de 18 km et la « P'tite Fleurinoise » d'une longueur de 12 km.</p>
              <p>Les departs seront donnes de la salle polyvalente de Fleurieux sur l'Arbresle, rue de Bel Air.</p>
              <p>1 ravitaillement pour la « P'tite Fleurinoise » au 8eme kilometre et 2 ravitaillements sur la « Fleurinoise » au 10eme & 15eme kilometre.</p>
              <p>Inscriptions avant le 1 septembre 2026. Retrait des dossards le 26 septembre 2026.</p>
            </body>
          </html>
        `);
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    const preview = await buildOrganizerWebsiteImportPreview("https://chouette.example/", {
      formatUrls: ["https://chouette.example/les-parcours", "https://chouette.example/reglement"],
    });

    expect(preview.event.raceDate).toBe("2026-09-27");
    expect(preview.event.name).toBe("Les Foulees Fleurinoises");
    expect(preview.races.map((race) => race.distanceKm)).toEqual([12, 18]);
    expect(preview.races.map((race) => race.name)).toEqual(["P'tite Fleurinoise", "Fleurinoise"]);
    expect(preview.races.find((race) => race.name === "P'tite Fleurinoise")?.aidStations.map((station) => station.distanceKm)).toEqual([8]);
    expect(preview.races.find((race) => race.name === "Fleurinoise")?.aidStations.map((station) => station.distanceKm)).toEqual([10, 15]);
    expect(preview.races.every((race) => (race.assessment?.coverageScore ?? 100) < 80)).toBe(true);
    expect(preview.races[0].assessment?.findings.find((finding) => finding.key === "elevationGainM")).toMatchObject({
      value: null,
      confidence: null,
    });
    expect(preview.races[0].assessment?.findings.find((finding) => finding.key === "aidStations")?.value).toContain("8 km");
    expect(preview.warnings.some((warning) => warning.includes("2025"))).toBe(true);
  });
});
