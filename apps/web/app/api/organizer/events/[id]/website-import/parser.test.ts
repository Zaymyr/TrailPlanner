import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildOrganizerWebsiteImportAnalysis,
  buildOrganizerWebsiteImportPreview,
  computeOrganizerWebsiteImportPreviewHash,
} from "../../../../../../lib/organizer-website-import";
import { getTraceDeTrailRaceData } from "../../../../../../lib/tracedetrail-race-import";

vi.mock("server-only", () => ({}));
vi.mock("../../../../../../lib/tracedetrail-race-import", () => ({
  getTraceDeTrailRaceData: vi.fn(),
  TraceDeTrailImportError: class TraceDeTrailImportError extends Error {},
}));

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
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts formats embedded in accessible tab panels on the event page", async () => {
    const traceResult = (traceId: number, courseName: string, distanceKm: number, elevationGainM: number, elevationLossM: number) => ({
      traceId,
      normalizedUrl: `https://tracedetrail.fr/fr/trace/${traceId}`,
      courseName,
      eventName: "Trail des Rois Maudits",
      officialSiteUrl: "https://trail.example/",
      thumbnailUrl: null,
      distanceKm,
      elevationGainM,
      elevationLossM,
      date: "2026-09-27",
      location: "Les Andelys",
      aidStations: [],
      elevationProfile: [],
      gpxContent: "<gpx />",
      gpxAccessMode: "embedded" as const,
    });
    vi.mocked(getTraceDeTrailRaceData).mockImplementation(async (url) =>
      String(url).endsWith("/254554")
        ? traceResult(254554, "TRM 60km", 60.4, 2500, 2410)
        : traceResult(290616, "TRM 44km", 43.6, 1810, 1840)
    );
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) !== "https://trail.example/") throw new Error(`Unexpected URL ${input}`);
      return htmlResponse(`
        <html><head><title>Trail des Rois Maudits</title></head><body>
          <p>Dimanche 27 septembre 2026</p>
          <div role="tab" aria-controls="panel-60"><span>TRM 60km</span></div>
          <div role="tab" aria-controls="panel-44"><span>TRM 44km</span></div>
          <div role="tabpanel" aria-labelledby="tab-panel-60">
            <p>60.4km</p><p>2500m</p><p>2410m</p>
            <a href="https://tracedetrail.fr/fr/trace/254554">GPX TRM60</a>
          </div>
          <div role="tabpanel" aria-labelledby="tab-panel-44">
            <p>43.6km</p><p>1810m</p><p>1840m</p>
            <a href="https://tracedetrail.fr/fr/trace/290616">GPX TRM44</a>
          </div>
        </body></html>
      `);
    });

    const preview = await buildOrganizerWebsiteImportPreview("https://trail.example/");

    expect(preview.races.map((race) => race.name)).toEqual(["TRM 44km", "TRM 60km"]);
    expect(preview.races.map((race) => race.distanceKm)).toEqual([43.6, 60.4]);
    expect(preview.races.map((race) => race.elevationGainM)).toEqual([1810, 2500]);
    expect(preview.races.map((race) => race.elevationLossM)).toEqual([1840, 2410]);
    expect(preview.races.every((race) => race.hasReliableGpx)).toBe(true);
  });

  it("discovers a bounded set of same-origin format pages when none are supplied", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://chouette.example/") {
        return htmlResponse(`
          <html><head><title>Les Foulees Fleurinoises</title></head><body>
            <p>Dimanche 27 septembre 2026</p>
            <a href="/reglement/">Reglement</a>
            <a href="/les-parcours/">Les parcours</a>
            <a href="https://elsewhere.example/formats">Formats externes</a>
          </body></html>
        `);
      }
      if (url === "https://chouette.example/reglement/") {
        return htmlResponse(`
          <p>REGLEMENT 2026 : Les Foulees Fleurinoises</p>
          <p>La « Fleurinoise » d'une longueur de 18 km et la « P'tite Fleurinoise » d'une longueur de 12 km.</p>
          <p>1 ravitaillement pour la « P'tite Fleurinoise » au 8eme kilometre et 2 ravitaillements sur la « Fleurinoise » au 10eme & 15eme kilometre.</p>
        `);
      }
      if (url === "https://chouette.example/les-parcours/") return htmlResponse("<p>Parcours 2026</p>");
      throw new Error(`Unexpected URL ${url}`);
    });

    const preview = await buildOrganizerWebsiteImportPreview("https://chouette.example/");

    expect(preview.races.map((race) => race.name)).toEqual(["P'tite Fleurinoise", "Fleurinoise"]);
    expect(preview.races.map((race) => race.distanceKm)).toEqual([12, 18]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("rebuilds a GPX from an embedded Waymark GeoJSON trace", async () => {
    vi.mocked(fetch).mockResolvedValue(
      htmlResponse(`
        <html>
          <head><title>Les Balcons de la Dordogne</title></head>
          <body>
            <h1>Les Balcons de la Dordogne</h1>
            <h3>Argentat-sur-Dordogne</h3>
            <h3>26 septembre à 10h00</h3>
            <h3>29.33 km</h3>
            <h3>1280 m</h3>
            <script>
              waymark_viewer.load_json({"type":"FeatureCollection","features":[{"type":"Feature","properties":{"title":"xtrail 2026 (29km) sur TraceDeTrail.fr","time":"2026-01-03T08:53:10+00:00"},"geometry":{"type":"LineString","coordinates":[[1.94398,45.10047,100],[1.95398,45.11047,300],[1.96398,45.12047,120]]}}]});
            </script>
          </body>
        </html>
      `)
    );

    const preview = await buildOrganizerWebsiteImportPreview(
      "https://xtrail.example/course/les-balcons-de-la-dordogne/"
    );

    expect(preview.event.raceDate).toBe("2026-09-26");
    expect(preview.races).toHaveLength(1);
    expect(preview.races[0]).toMatchObject({
      name: "Les Balcons de la Dordogne",
      raceDate: "2026-09-26",
      hasReliableGpx: true,
      gpxStorageLabel: "embedded-geojson",
      missingFields: [],
    });
    expect(preview.races[0].distanceKm).toBeGreaterThan(1);
    expect(preview.races[0].elevationGainM).toBeGreaterThan(0);
    expect(preview.races[0].gpxContent).toContain('<trkpt lat="45.10047" lon="1.94398"><ele>100</ele></trkpt>');
    expect(preview.races[0].assessment?.findings.find((finding) => finding.key === "gpx")).toMatchObject({
      value: "GPX exploitable",
      confidence: "high",
      sourceLabel: "Trace GPX",
    });
  });

  it("keeps every explicit XTrail format page distinct from an ambiguous root embedded route", async () => {
    const formatPages = new Map([
      ["https://xtrail.example/course/la-source/", { name: "La Source", distance: 15, elevation: 520 }],
      ["https://xtrail.example/course/les-balcons/", { name: "Les Balcons", distance: 29, elevation: 1280 }],
      ["https://xtrail.example/course/la-forteresse/", { name: "La Forteresse", distance: 50, elevation: 2300 }],
    ]);
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://xtrail.example/") {
        return htmlResponse(`
          <html><head><title>XTrail 2026</title></head><body>
            <h1>XTrail 2026</h1><p>26 septembre 2026</p>
            <script>
              waymark_viewer.load_json({"type":"FeatureCollection","features":[{"type":"Feature","properties":{"title":"XTrail 2026 (29km)","time":"2026-01-03T08:53:10+00:00"},"geometry":{"type":"LineString","coordinates":[[1.94,45.10,100],[1.95,45.11,300],[1.96,45.12,120]]}}]});
            </script>
          </body></html>
        `);
      }
      const format = formatPages.get(url);
      if (!format) throw new Error(`Unexpected URL ${url}`);
      return htmlResponse(`
        <html>
          <head>
            <script type="application/ld+json">
              {"@context":"https://schema.org","@type":"SportsEvent","name":"XTrail 2026","startDate":"2026-09-26","description":"Parcours officiel XTrail"}
            </script>
          </head>
          <body><h1>${format.name}</h1><p>${format.distance} km - D+ ${format.elevation} m - départ 9h00</p></body>
        </html>
      `);
    });

    const preview = await buildOrganizerWebsiteImportPreview("https://xtrail.example/", {
      formatUrls: [...formatPages.keys()],
    });

    expect(preview.races).toHaveLength(3);
    expect(preview.races.map((race) => race.name)).toEqual(expect.arrayContaining([
      "La Source",
      "Les Balcons",
      "La Forteresse",
    ]));
    expect(new Set(preview.races.map((race) => race.externalSiteUrl))).toEqual(new Set(formatPages.keys()));
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("keeps the root XTrail format when that same URL is repeated with three explicit sibling formats", async () => {
    const rootFormatUrl = "https://xtrail.example/course/les-balcons/";
    const siblingPages = new Map([
      ["https://xtrail.example/course/la-source/", { name: "La Source", distance: 15, elevation: 520 }],
      ["https://xtrail.example/course/la-forteresse/", { name: "La Forteresse", distance: 50, elevation: 2300 }],
      ["https://xtrail.example/course/l-ultra/", { name: "L'Ultra", distance: 80, elevation: 3900 }],
    ]);
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === rootFormatUrl) {
        return htmlResponse(`
          <html><head><title>Les Balcons - XTrail 2026</title></head><body>
            <h1>Les Balcons</h1><p>29 km - D+ 1280 m - 26 septembre 2026</p>
            <p>Accès spectateurs à 2.5 km du départ.</p>
            <script>
              waymark_viewer.load_json({"type":"FeatureCollection","features":[{"type":"Feature","properties":{"title":"XTrail 2026 (29km)","time":"2026-01-03T08:53:10+00:00"},"geometry":{"type":"LineString","coordinates":[[1.94,45.10,100],[1.95,45.11,300],[1.96,45.12,120]]}}]});
            </script>
          </body></html>
        `);
      }
      const format = siblingPages.get(url);
      if (!format) throw new Error(`Unexpected URL ${url}`);
      return htmlResponse(`
        <html>
          <head>
            <script type="application/ld+json">
              {"@context":"https://schema.org","@type":"SportsEvent","name":"XTrail 2026","startDate":"2026-09-26","description":"Parcours officiel XTrail"}
            </script>
          </head>
          <body><h1>${format.name}</h1><p>${format.distance} km - D+ ${format.elevation} m - départ 9h00</p></body>
        </html>
      `);
    });

    const preview = await buildOrganizerWebsiteImportPreview(rootFormatUrl, {
      formatUrls: [rootFormatUrl, ...siblingPages.keys()],
    });

    expect(preview.races).toHaveLength(4);
    expect(preview.races.map((race) => race.name)).toEqual(expect.arrayContaining([
      "Les Balcons",
      "La Source",
      "La Forteresse",
      "L'Ultra",
    ]));
    expect(new Set(preview.races.map((race) => race.externalSiteUrl))).toEqual(
      new Set([rootFormatUrl, ...siblingPages.keys()])
    );
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("groups named detections up to 1.5 km apart", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://distance.example/") {
        return htmlResponse("<html><head><title>Trail Distance</title></head><body><p>26 septembre 2026</p></body></html>");
      }
      if (url === "https://distance.example/course") {
        return htmlResponse("<h1>Les Balcons</h1><p>30.4 km - D+ 1280</p>");
      }
      if (url === "https://distance.example/reglement") {
        return htmlResponse('<p>La « Course des Balcons » d\'une longueur de 29,09 km. Ravitaillement au 15eme kilometre.</p>');
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const preview = await buildOrganizerWebsiteImportPreview("https://distance.example/", {
      formatUrls: ["https://distance.example/course", "https://distance.example/reglement"],
    });

    expect(preview.races).toHaveLength(1);
    expect(preview.races[0].distanceKm).toBe(30.4);
  });

  it("does not merge an anonymous GPX detection into a named format from distance alone", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://distance.example/") {
        return htmlResponse("<html><head><title>X Trail</title></head><body><p>26 septembre 2026</p></body></html>");
      }
      if (url === "https://distance.example/grand-trail") {
        return htmlResponse("<h1>Grand Trail des Tours</h1><p>56 km</p>");
      }
      if (url === "https://distance.example/parcours-gpx") {
        return htmlResponse('<p>56,6 km - parcours GPX</p><p>D+ 2931 m</p><a href="/grand-trail.gpx">Telecharger le GPX</a>');
      }
      if (url === "https://distance.example/grand-trail.gpx") return gpxResponse();
      throw new Error(`Unexpected URL ${url}`);
    });

    const preview = await buildOrganizerWebsiteImportPreview("https://distance.example/", {
      formatUrls: ["https://distance.example/grand-trail", "https://distance.example/parcours-gpx"],
    });

    expect(preview.races).toHaveLength(2);
    expect(preview.races).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Grand Trail des Tours", hasReliableGpx: false }),
      expect.objectContaining({ name: "56.6 km" }),
    ]));
  });

  it("keeps nearby formats separate when their distinctive names are incompatible", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://nearby.example/") {
        return htmlResponse("<html><head><title>Trail Double</title></head><body><p>26 septembre 2026</p></body></html>");
      }
      if (url === "https://nearby.example/formats") {
        return htmlResponse(`
          <h2>Cretes du Soleil</h2><p>30 km - D+ 1200 m</p>
          <h2>Boucle des Forets</h2><p>31 km - D+ 900 m</p>
        `);
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const preview = await buildOrganizerWebsiteImportPreview("https://nearby.example/", {
      formatUrls: ["https://nearby.example/formats"],
    });

    expect(preview.races).toHaveLength(2);
    expect(preview.races.map((race) => race.name)).toEqual(["Cretes du Soleil", "Boucle des Forets"]);
    expect(preview.races.map((race) => race.distanceKm)).toEqual([30, 31]);
  });

  it("resolves conflicting fields from the more reliable structured source", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://reliability.example/") {
        return htmlResponse("<html><head><title>Trail Fiable</title></head><body><p>26 septembre 2026</p></body></html>");
      }
      if (url === "https://reliability.example/summary") {
        return htmlResponse("<p>Cime Noire 30 km - parcours - D+ 100 m - depart 9h</p>");
      }
      if (url === "https://reliability.example/formats") {
        return htmlResponse("<h2>Cime Noire</h2><p>30 km - D+ 900 m</p>");
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const preview = await buildOrganizerWebsiteImportPreview("https://reliability.example/", {
      formatUrls: ["https://reliability.example/summary", "https://reliability.example/formats"],
    });

    expect(preview.races).toHaveLength(1);
    expect(preview.races[0]).toMatchObject({
      name: "Cime Noire",
      distanceKm: 30,
      elevationGainM: 900,
    });
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
    expect(preview.races.map((race) => race.elevationGainM)).toEqual([100, 100, 100]);
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
              <h2>Course : La Grande Traversée — 20 km · 1000 D+</h2>
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

    expect(preview.races.map((race) => race.name)).toEqual(["La Grande Traversée", "10 km"]);
    expect(preview.races[0].assessment?.score).toBeGreaterThan(preview.races[1].assessment?.score ?? 0);
  });

  it("merges compatible same-distance detections and keeps the first page name while GPX supplies elevation", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://w45.example/") {
        return htmlResponse(`<html><head><title>W45</title></head><body><p>Dimanche 17 mai 2026</p></body></html>`);
      }
      if (url === "https://w45.example/format") {
        return htmlResponse(`
          <html><body>
            <h1>W45</h1>
            <p>45,6 km · D+ 100 m</p>
            <h2>Parcours W45</h2>
            <p>45,6 km · D+ 200 m</p>
            <a href="/w45.gpx">GPX</a>
          </body></html>
        `);
      }
      if (url === "https://w45.example/w45.gpx") return gpxResponse();
      throw new Error(`Unexpected URL ${url}`);
    });

    const preview = await buildOrganizerWebsiteImportPreview("https://w45.example/", {
      formatUrls: ["https://w45.example/format"],
    });

    expect(preview.races).toHaveLength(1);
    expect(preview.races[0]).toMatchObject({
      name: "W45",
      distanceKm: 45.6,
      elevationGainM: 100,
      hasReliableGpx: true,
    });
  });

  it("recovers a Trace de Trail GPX from lazy iframes on a format page", async () => {
    vi.mocked(getTraceDeTrailRaceData).mockResolvedValue({
      traceId: 316035,
      normalizedUrl: "https://tracedetrail.fr/fr/trace/316035",
      courseName: "W100",
      eventName: "THP Winter 2026",
      officialSiteUrl: "https://mythp.fr/thp-winter/w100/",
      thumbnailUrl: null,
      distanceKm: 102,
      elevationGainM: 5310,
      elevationLossM: 5290,
      date: "2026-11-21",
      location: "Saint-Etienne-les-Orgues",
      aidStations: [{ name: "Lardiers", distanceKm: 42.5, waterRefill: true }],
      elevationProfile: [],
      gpxContent: "<gpx><trk><trkseg><trkpt lat=\"45\" lon=\"6\" /></trkseg></trk></gpx>",
      gpxAccessMode: "embedded",
    });

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://mythp.fr/thp-winter/") {
        return htmlResponse(`
          <html><head><title>THP Winter</title></head><body><p>21 novembre 2026</p></body></html>
        `);
      }
      if (url === "https://mythp.fr/thp-winter/w100/") {
        return htmlResponse(`
          <html><body>
            <h1>W100</h1>
            <p>102 km - 5 300 D+</p>
            <h2>Informations techniques</h2>
            <iframe src="about:blank" data-litespeed-src="https://tracedetrail.fr/fr/iframe/9321"></iframe>
            <iframe src="about:blank" data-litespeed-src="https://tracedetrail.fr/fr/iframe/9324"></iframe>
          </body></html>
        `);
      }
      if (url === "https://tracedetrail.fr/fr/iframe/9321") {
        return htmlResponse(`<a id="logoPlatform" href="https://tracedetrail.fr/fr/trace/316035">Trace</a>`);
      }
      if (url === "https://tracedetrail.fr/fr/iframe/9324") {
        return htmlResponse(`<script>const options = { traceID:316035 };</script>`);
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const preview = await buildOrganizerWebsiteImportPreview("https://mythp.fr/thp-winter/", {
      formatUrls: ["https://mythp.fr/thp-winter/w100/"],
    });

    expect(getTraceDeTrailRaceData).toHaveBeenCalledTimes(1);
    expect(getTraceDeTrailRaceData).toHaveBeenCalledWith("https://tracedetrail.fr/fr/trace/316035");
    expect(preview.races).toHaveLength(1);
    expect(preview.races[0]).toMatchObject({
      name: "W100",
      elevationGainM: 5310,
      elevationLossM: 5290,
      gpxStorageLabel: "tracedetrail",
      hasReliableGpx: true,
      aidStations: [{ name: "Lardiers", distanceKm: 42.5 }],
    });
    expect(preview.races[0].assessment?.findings.find((finding) => finding.key === "gpx")).toMatchObject({
      value: "GPX exploitable",
      confidence: "high",
      sourceUrl: "https://tracedetrail.fr/fr/trace/316035",
    });
  });

  it("changes the preview hash when only the GPX content changes", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://hash.example/") {
        return htmlResponse("<html><head><title>Hash Trail</title></head><body><p>26 septembre 2026</p></body></html>");
      }
      if (url === "https://hash.example/format") {
        return htmlResponse('<h1>Hash 20</h1><p>20 km - D+ 800 m</p><a href="/hash.gpx">GPX</a>');
      }
      if (url === "https://hash.example/hash.gpx") return gpxResponse();
      throw new Error(`Unexpected URL ${url}`);
    });

    const preview = await buildOrganizerWebsiteImportPreview("https://hash.example/", {
      formatUrls: ["https://hash.example/format"],
    });
    const originalHash = computeOrganizerWebsiteImportPreviewHash(preview);
    const changedGpxPreview = {
      ...preview,
      races: preview.races.map((race, index) =>
        index === 0 ? { ...race, gpxContent: `${race.gpxContent}\n<!-- changed -->` } : race
      ),
    };

    expect(computeOrganizerWebsiteImportPreviewHash(changedGpxPreview)).not.toBe(originalHash);
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

  it("loads supplemental official URLs as classified source documents without making them authoritative formats", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://sources.example/event") {
        return htmlResponse(`
          <html><head><title>Trail des Sources</title></head><body>
            <p>Dimanche 4 octobre 2026</p>
            <div role="tab" aria-controls="format-25">Source 25</div>
            <div role="tabpanel" id="format-25"><p>25 km</p><p>900 m D+</p></div>
          </body></html>
        `);
      }
      if (url === "https://registration.example/inscriptions") {
        return htmlResponse(`
          <html><head><title>Inscriptions officielles</title></head><body>
            <p>Inscriptions avant le 20 septembre 2026.</p>
            <p>Retrait des dossards samedi de 16h a 19h.</p>
          </body></html>
        `);
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const analysis = await buildOrganizerWebsiteImportAnalysis("https://sources.example/event", {
      additionalUrls: ["https://registration.example/inscriptions"],
    });

    expect(analysis.preview.races).toHaveLength(0);
    expect(analysis.sourceDocuments).toEqual([
      expect.objectContaining({ url: "https://sources.example/event", isPrimary: true, discovery: "primary" }),
      expect.objectContaining({
        url: "https://registration.example/inscriptions",
        isPrimary: false,
        discovery: "additional",
      }),
    ]);
  });

  it("keeps all twelve explicitly supplied official sources within the bounded crawl", async () => {
    const additionalUrls = Array.from({ length: 12 }, (_, index) => `https://sources.example/officielle-${index + 1}`);
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://sources.example/evenement") {
        return htmlResponse("<html><head><title>Trail des Sources</title></head><body>Edition 2026</body></html>");
      }
      if (additionalUrls.includes(url)) {
        return htmlResponse(`<html><head><title>Source ${url.split("-").at(-1)}</title></head><body>Information officielle.</body></html>`);
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const analysis = await buildOrganizerWebsiteImportAnalysis("https://sources.example/evenement", { additionalUrls });

    expect(analysis.sourceDocuments).toHaveLength(13);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(13);
  });
});
