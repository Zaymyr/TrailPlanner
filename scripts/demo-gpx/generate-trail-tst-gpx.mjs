#!/usr/bin/env node
/**
 * Generates the Trail TST demo GPX files (supabase/demo-assets/trail-tst-{18,42,82}.gpx).
 *
 * The demo event is shown to prospects (brochure QR code) and sits first in the public race catalog, so its
 * GPX must agree with its catalog row: distance, D+, altitude range and the aid stations seeded in
 * `supabase/migrations/20260827093348_seed_trail_tst_demo_event.sql`. The previous 13-point tracks measured
 * ~24 km for the 42 km race, so the planner showed 23,8 km / 4h20 right after an estimate of 42,6 km / 8h09.
 *
 * Each track is a dense closed loop starting and finishing at Samoëns (46.0832, 6.7264). The loop radius is
 * scaled so the haversine length equals the catalog distance, and the altitude follows piecewise-linear
 * control points that pass through every aid station altitude and sum to the catalog D+.
 *
 * Usage: node scripts/demo-gpx/generate-trail-tst-gpx.mjs  (writes the three files and prints their stats)
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const START = { lat: 46.0832, lon: 6.7264 };
const STEP_KM = 0.05;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "demo-assets");

/** Catalog facts (seed migration): distance, D+ and aid stations; `profile` = [km, altitude] control points. */
const RACES = [
  {
    file: "trail-tst-18.gpx",
    name: "Trail TST 18 - Balcon des Erables",
    distanceKm: 18.4,
    gainM: 860,
    lobes: 2,
    aidStations: [
      { name: "Chalet des Fontaines", km: 7.2 },
      { name: "Le Bémont", km: 13.4 },
    ],
    profile: [
      [0, 710], [4.5, 1000], [6.2, 1220], [7.2, 1125], [9.5, 1410], [11.8, 1015], [13.4, 1080], [18.4, 710],
    ],
  },
  {
    file: "trail-tst-42.gpx",
    name: "Trail TST 42 - Traversee des Alpages",
    distanceKm: 42.6,
    gainM: 2450,
    lobes: 3,
    aidStations: [
      { name: "Plateau de la Mouille", km: 9.5 },
      { name: "Col de Joux Plane", km: 18.6 },
      { name: "Refuge de Bostan", km: 28.4 },
      { name: "Vercland", km: 36.2 },
    ],
    profile: [
      [0, 710], [8, 1430], [9.5, 1310], [12, 1250], [16.5, 1850], [18.6, 1691], [20.5, 1420], [24.5, 1930],
      [26, 1780], [27.4, 1930], [28.4, 1763], [31, 1450], [32.6, 1780], [36.2, 920], [38.4, 780], [39.8, 920],
      [42.6, 710],
    ],
  },
  {
    file: "trail-tst-82.gpx",
    name: "Trail TST 82 - Ultra des Cimes",
    distanceKm: 82.3,
    gainM: 5120,
    lobes: 4,
    aidStations: [
      { name: "La Golèse", km: 12 },
      { name: "Col de Joux Plane – relais 1", km: 25.5 },
      { name: "Base de vie de Bostan", km: 39 },
      { name: "Vercland – relais 2", km: 51.5 },
      { name: "Lac des Mines d’Or", km: 65 },
      { name: "Les Allamands", km: 75.5 },
    ],
    profile: [
      [0, 710], [10, 1830], [12, 1670], [15, 1400], [21.5, 2110], [25.5, 1691], [29, 1400], [35, 2260],
      [39, 1763], [43, 1500], [45, 1950], [46, 1700], [47, 1900], [51.5, 920], [56, 960], [61, 1840],
      [65, 1390], [69, 1220], [70.5, 1600], [71.5, 1350], [72.5, 1460], [75.5, 1096], [78.5, 1010],
      [79, 1300], [79.6, 1050], [80, 1130], [82.3, 710],
    ],
  },
];

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg) => (deg * Math.PI) / 180;
const haversineKm = (a, b) => {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

/** Closed wavy loop through START; `scale` is the mean radius in km. */
function loopPoints(scale, lobes, count) {
  const kmPerDegLat = 111.32;
  const kmPerDegLon = 111.32 * Math.cos(toRad(START.lat));
  const radius = (theta) => scale * (1 + 0.28 * Math.sin(lobes * theta));
  // The loop is centred so that theta = 0 sits on START.
  const center = { x: -radius(0), y: 0 };
  const points = [];
  for (let index = 0; index <= count; index += 1) {
    const theta = (2 * Math.PI * index) / count;
    const r = radius(theta);
    const x = center.x + r * Math.cos(theta);
    const y = center.y + r * Math.sin(theta);
    points.push({ lat: START.lat + y / kmPerDegLat, lon: START.lon + x / kmPerDegLon });
  }
  points[points.length - 1] = { ...START };
  return points;
}

const pathLengthKm = (points) => points.slice(1).reduce((sum, point, index) => sum + haversineKm(points[index], point), 0);

function altitudeAt(profile, km) {
  for (let index = 1; index < profile.length; index += 1) {
    const [km0, alt0] = profile[index - 1];
    const [km1, alt1] = profile[index];
    if (km <= km1) return alt0 + ((alt1 - alt0) * (km - km0)) / (km1 - km0);
  }
  return profile[profile.length - 1][1];
}

const profileGain = (profile) =>
  profile.slice(1).reduce((sum, [, alt], index) => sum + Math.max(0, alt - profile[index][1]), 0);

function buildRace(race) {
  if (profileGain(race.profile) !== race.gainM) {
    throw new Error(`${race.file}: control points give ${profileGain(race.profile)} m D+, expected ${race.gainM} m`);
  }
  const count = Math.round(race.distanceKm / STEP_KM);
  // Length is proportional to the scale: one correction pass lands on the target distance.
  const firstScale = race.distanceKm / (2 * Math.PI);
  const scale = firstScale * (race.distanceKm / pathLengthKm(loopPoints(firstScale, race.lobes, count)));
  const points = loopPoints(scale, race.lobes, count);

  let cumulativeKm = 0;
  const track = points.map((point, index) => {
    if (index > 0) cumulativeKm += haversineKm(points[index - 1], point);
    return { ...point, km: cumulativeKm, ele: altitudeAt(race.profile, cumulativeKm) };
  });

  const waypointFor = (km) => track.reduce((best, point) => (Math.abs(point.km - km) < Math.abs(best.km - km) ? point : best));
  const escape = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const coordinate = (value) => value.toFixed(6);

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Pace Yourself demo" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${escape(race.name)}</name></metadata>`,
    ...race.aidStations.map((station) => {
      const point = waypointFor(station.km);
      return `  <wpt lat="${coordinate(point.lat)}" lon="${coordinate(point.lon)}"><ele>${point.ele.toFixed(1)}</ele><name>${escape(station.name)}</name><type>aid_station</type></wpt>`;
    }),
    `  <trk><name>${escape(race.name)}</name><trkseg>`,
    ...track.map((point) => `    <trkpt lat="${coordinate(point.lat)}" lon="${coordinate(point.lon)}"><ele>${point.ele.toFixed(1)}</ele></trkpt>`),
    "  </trkseg></trk>",
    "</gpx>",
    "",
  ];
  const content = lines.join("\n");
  const elevations = track.map((point) => point.ele);
  const gain = track.slice(1).reduce((sum, point, index) => sum + Math.max(0, point.ele - track[index].ele), 0);
  return {
    content,
    stats: {
      file: race.file,
      distanceKm: Number(cumulativeKm.toFixed(2)),
      gainM: Math.round(gain),
      minAltM: Math.round(Math.min(...elevations)),
      maxAltM: Math.round(Math.max(...elevations)),
      points: track.length,
      sha256: createHash("sha256").update(content).digest("hex"),
    },
  };
}

for (const race of RACES) {
  const { content, stats } = buildRace(race);
  writeFileSync(join(OUT_DIR, race.file), content, "utf8");
  console.log(JSON.stringify(stats));
}
