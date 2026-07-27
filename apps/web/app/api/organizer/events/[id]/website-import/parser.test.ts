import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildOrganizerWebsiteImportPreview } from "../../../../../../lib/organizer-website-import";

vi.mock("server-only", () => ({}));

const htmlResponse = (html: string) =>
  new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

describe("buildOrganizerWebsiteImportPreview generic fallback", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("follows parcours pages and extracts multiple detailed formats", async () => {
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
              <a href="/les-parcours">Les Parcours</a>
            </body>
          </html>
        `);
      }

      if (url === "https://trailfort.example/les-parcours") {
        return htmlResponse(`
          <html>
            <body>
              <h2>L'Abbaye</h2>
              <p>11 km - 500 D+</p>
              <p>Depart 9h30</p>
              <p>Ravitaillement : km7</p>

              <h2>La Belle Etoile</h2>
              <p>15 km - 1100 D+</p>
              <p>Ravitaillement : km11</p>

              <h2>Les 2 Savoies</h2>
              <p>25 km - 1850 D+</p>
              <p>Ravitaillement : km7, km15</p>
            </body>
          </html>
        `);
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    const preview = await buildOrganizerWebsiteImportPreview("https://trailfort.example/");

    expect(preview.source.provider).toBe("generic");
    expect(preview.event.name).toBe("Trail du Fort de Tamie");
    expect(preview.event.raceDate).toBe("2026-05-17");
    expect(preview.races).toHaveLength(3);
    expect(preview.races.map((race) => race.name)).toEqual(["L'Abbaye", "La Belle Etoile", "Les 2 Savoies"]);
    expect(preview.races.map((race) => race.distanceKm)).toEqual([11, 15, 25]);
    expect(preview.races.map((race) => race.elevationGainM)).toEqual([500, 1100, 1850]);
    expect(preview.races.find((race) => race.name === "Les 2 Savoies")?.aidStations.map((station) => station.distanceKm)).toEqual([
      7, 15,
    ]);
  });

  it("prefers the current edition page when other pages describe an older year", async () => {
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
              <p>27 septembre</p>
              <a href="/les-parcours">Les Parcours</a>
              <a href="/reglement">Reglement</a>
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
              <p>Dimanche 27 septembre 2026</p>
              <p>18 km - 2 ravitaillements : km10, km15</p>
              <p>12 km - 1 ravitaillement : km8</p>
            </body>
          </html>
        `);
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    const preview = await buildOrganizerWebsiteImportPreview("https://chouette.example/");

    expect(preview.event.raceDate).toBe("2026-09-27");
    expect(preview.races.map((race) => race.distanceKm)).toEqual([12, 18]);
    expect(preview.warnings.some((warning) => warning.includes("2025"))).toBe(true);
  });
});
