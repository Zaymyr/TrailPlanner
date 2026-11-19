import type { VideoAidStation, VideoRoutePoint } from "../../../lib/video-generator";

/**
 * Test fixtures shaped like two real test races. The race records and aid stations (name, km,
 * cutoff, life base) are the catalog values of 2026-11-19; the GPX profiles are synthetic (the real
 * GPX files stay in private Storage), with a GPX length a few percent off the race record on
 * purpose, so the race-figures rescale is exercised.
 */

type FixtureRace = {
  race: { title: string; distanceKm: number; elevationGainM: number; startDetail: string | null; raceDate: string; startTime: string | null };
  points: VideoRoutePoint[];
  aidStations: VideoAidStation[];
};

const station = (index: number, name: string, distanceKm: number, overrides: Partial<VideoAidStation> = {}): VideoAidStation => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  name,
  distanceKm,
  waterAvailable: true,
  foodAvailable: true,
  assistanceAllowed: true,
  isLifeBase: false,
  dropBagAvailable: false,
  cutoffTime: null,
  ...overrides,
});

/** Points every 100 m along a piecewise-linear profile, with a small deterministic ripple. */
const profilePoints = (nodes: Array<[number, number]>, latitude: number): VideoRoutePoint[] => {
  const totalKm = nodes[nodes.length - 1][0];
  const count = Math.round(totalKm * 10);
  return Array.from({ length: count + 1 }, (_, index) => {
    const distanceKm = Math.min(totalKm, index / 10);
    const upper = Math.max(1, nodes.findIndex(([km]) => km >= distanceKm));
    const [fromKm, fromM] = nodes[upper - 1];
    const [toKm, toM] = nodes[upper];
    const t = toKm > fromKm ? (distanceKm - fromKm) / (toKm - fromKm) : 0;
    return {
      lat: latitude + distanceKm / 160,
      lon: 3 + Math.sin(distanceKm / 9) * 0.05,
      elevationM: fromM + (toM - fromM) * t + 1.5 * Math.sin(distanceKm * 7),
      distanceKm,
    };
  });
};

/** Hivernale des Templiers 2026, Astragale Trail: 66.63 km, 2,276 m D+, no start time. */
export const astragaleTrail: FixtureRace = {
  race: { title: "Astragale Trail", distanceKm: 66.63, elevationGainM: 2276, startDetail: null, raceDate: "2026-12-06", startTime: null },
  points: profilePoints([
    [0, 400], [4, 420], [7, 780], [10, 500], [14, 520], [16, 400], [19, 800], [23, 560], [27, 820], [30, 450],
    [35, 880], [39, 560], [44, 600], [48, 900], [52, 700], [54, 760], [58, 520], [61, 860], [64.9, 400],
  ], 44.1),
  aidStations: [
    station(1, "Lapanouse de Cernon", 16.2),
    station(2, "Sainte-Eulalie-de-Cernon", 30.2),
    station(3, "Le Viala-du-Pas-de-Jaux", 53.9),
  ],
};

/** Many Morvan-like bumps of 65 to 145 m, one bigger climb near km 90, over a 188 km GPX. */
const druidesNodes = (): Array<[number, number]> => {
  const nodes: Array<[number, number]> = [[0, 320]];
  const legs = 56;
  for (let index = 0; index < legs; index += 1) {
    const topKm = ((index + 0.5) / legs) * 188;
    const footKm = ((index + 1) / legs) * 188;
    const foot = 320 + 60 * Math.sin(index * 0.9);
    const height = index === 27 ? 430 : 105 + 40 * Math.sin(index * 1.7);
    nodes.push([Number(topKm.toFixed(2)), foot + height]);
    nodes.push([Number(footKm.toFixed(2)), 320 + 60 * Math.sin((index + 1) * 0.9)]);
  }
  return nodes;
};

/** Bibracte Ultra-Trail 2026, L'Ultra des Druides: 184.7 km, 5,520 m D+, start 14:00. */
export const ultraDesDruides: FixtureRace = {
  race: { title: "L'Ultra des Druides", distanceKm: 184.7, elevationGainM: 5520, startDetail: "Bibracte · 13 novembre · 14:00", raceDate: "2026-11-13", startTime: "14:00" },
  points: profilePoints(druidesNodes(), 46.9),
  aidStations: [
    station(11, "La Comelle", 21),
    station(12, "Millay", 40),
    station(13, "Villapourçon", 58),
    station(14, "Onlay", 66, { cutoffTime: "07:00" }),
    station(15, "Glux-en-Glenne", 86, { cutoffTime: "12:00", isLifeBase: true, dropBagAvailable: true }),
    station(16, "Fâchin", 107),
    station(17, "Arleuf", 123),
    station(18, "Athez", 131, { cutoffTime: "01:00", isLifeBase: true }),
    station(19, "Roussillon-en-Morvan", 149, { cutoffTime: "05:00" }),
    station(20, "La Grande-Verrière", 165, { cutoffTime: "09:00" }),
    station(21, "Saint-Prix", 172, { cutoffTime: "11:00", foodAvailable: false }),
  ],
};
