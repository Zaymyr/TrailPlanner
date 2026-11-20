import { buildBand, parisStartUtcMs, type BandLayout } from "./carousel-band";
import { formatDayMonth, formatKm, formatNumber, upper } from "./carousel-format";
import { computePlanNutrition, type PlanRow, type SentencePart } from "./carousel-nutrition";

/**
 * « Le plan chiffré » (pure): the three slides drawn as one continuous strip (four when the
 * sections need a « suite »), from the race data and the nutrition figures.
 */

export type CarouselRaceData = {
  raceId: string;
  raceName: string;
  eventName: string;
  /** Short event name (race_events.short_name or derived), for labels. */
  shortName: string;
  raceDate: string;
  startTime: string | null;
  distanceKm: number;
  elevationGainM: number | null;
  elevationLossM: number | null;
  profile: Array<{ km: number; elevationM: number }> | null;
  lat: number;
  lon: number;
  stations: Array<{ name: string; km: number; waterAvailable: boolean; solidAvailable: boolean; cutoffTime: string | null }>;
  finishCutoffTime: string | null;
  startName: string | null;
  finishName: string | null;
  livret: { available: boolean; equipment: boolean; bibPickup: boolean; access: boolean; services: boolean };
};

export type PlanRowView = {
  kmText: string;
  lengthText: string;
  hourText: string | null;
  grams: string;
  donePct: number;
  nowPct: number;
  cumulText: string;
  cumulPct: string;
};

export type PlanSnapshot = {
  series: "plan";
  slideCount: number;
  eyebrow: string;
  h1: string;
  h1Size: number;
  km: string;
  dplus: string;
  stationCount: number;
  big: string;
  label2: string;
  label3: string;
  objectives: Array<{ label: string; carbsPerHour: number; waterMlPerHour: number; sodiumMgPerHour: number; totalCarbsG: number; total: string }>;
  sentence: SentencePart[];
  chartLabel: string;
  rowsMode: "sections" | "hours";
  density: "tall" | "compact";
  pages: PlanRowView[][];
  total: string;
  band: BandLayout;
};

export type PlanSnapshotResult = { ok: true; snapshot: PlanSnapshot; figures: PlanFigures } | { ok: false; reason: string };

/** The figures the caption writer may quote (and only these). */
export type PlanFigures = { distanceKm: string; elevationGainM: string; objectives: string[]; perHour: number[]; totals: number[]; middleTotal: number; stationCount: number };

/** The race title with its distance when the name does not say it. */
export const titleWithDistance = (raceName: string, distanceKm: number) =>
  /\d\s*(km|k)\b/i.test(raceName) ? raceName : `${raceName} ${formatKm(distanceKm)} km`;

const h1SizeFor = (text: string) => (text.length <= 40 ? 96 : text.length <= 56 ? 84 : 72);

const toRowView = (row: PlanRow, total: number): PlanRowView => ({
  kmText: `KM ${formatKm(row.fromKm)} → ${formatKm(row.toKm)}`,
  lengthText: `${formatKm(row.lengthKm)} KM`,
  hourText: row.fromHour !== null && row.toHour !== null ? `${formatNumber(row.fromHour, 1)} H → ${formatNumber(row.toHour, 1)} H` : null,
  grams: `${formatNumber(row.grams)} g`,
  donePct: Number(((row.doneBefore / total) * 100).toFixed(1)),
  nowPct: Number(((row.grams / total) * 100).toFixed(1)),
  cumulText: `${formatNumber(row.cumul)} / ${formatNumber(total)} g`,
  cumulPct: `${Math.round((row.cumul / total) * 100)} %`,
});

export const buildPlanSnapshot = (race: CarouselRaceData): PlanSnapshotResult => {
  const nutrition = computePlanNutrition({
    distanceKm: race.distanceKm,
    elevationGainM: race.elevationGainM,
    elevationLossM: race.elevationLossM,
    points: race.profile?.map((point) => ({ distanceKm: point.km, elevationM: point.elevationM })) ?? null,
    aidStations: race.stations.map((station) => ({ name: station.name, distanceKm: station.km })),
  });
  if (!nutrition.ok) return nutrition;
  const figures = nutrition.value;
  const slideCount = 2 + figures.pages.length;
  const startUtcMs = parisStartUtcMs(race.raceDate, race.startTime);
  const band = buildBand({
    slideCount,
    totalKm: race.distanceKm,
    elevationGainM: race.elevationGainM,
    profile: race.profile,
    stations: race.stations.map((station) => ({ km: station.km, name: station.name })),
    startLabel: race.startName ?? "Départ",
    finishLabel: race.finishName ?? "Arrivée",
    clock: startUtcMs === null ? null : { startUtcMs, lat: race.lat, lon: race.lon, timeline: figures.timeline },
  });
  const title = titleWithDistance(race.raceName, race.distanceKm);
  const h1 = `Combien manger sur ${title} ?`;
  const middle = figures.objectives[figures.middleIndex];
  const shortLabel = `${upper(race.shortName)} ${formatKm(race.distanceKm)} KM`;
  const dplus = race.elevationGainM ?? 0;
  const objectives = figures.objectives.map((objective) => ({
    label: objective.label,
    carbsPerHour: objective.carbsPerHour,
    waterMlPerHour: objective.waterMlPerHour,
    sodiumMgPerHour: objective.sodiumMgPerHour,
    totalCarbsG: objective.totalCarbsG,
    total: `${formatNumber(objective.totalCarbsG)} g`,
  }));
  const snapshot: PlanSnapshot = {
    series: "plan",
    slideCount,
    eyebrow: `${upper(race.eventName)} · ${formatDayMonth(race.raceDate)}`,
    h1,
    h1Size: h1SizeFor(h1),
    km: formatKm(race.distanceKm),
    dplus: formatNumber(dplus),
    stationCount: race.stations.filter((station) => station.km > 0 && station.km < race.distanceKm).length,
    big: figures.rangeLabel,
    label2: `LE PLAN CHIFFRÉ · ${shortLabel}`,
    label3: `LE PLAN CHIFFRÉ · OBJECTIF ${upper(middle.label)}`,
    objectives,
    sentence: figures.sentence,
    chartLabel: `Pour ${figures.objectives.map((objective) => objective.label).join(", ")} d’objectif : ${objectives.map((objective) => objective.carbsPerHour).join(", ")} g de glucides par heure, et ${objectives.map((objective) => formatNumber(objective.totalCarbsG)).join(", ")} g au total.`,
    rowsMode: figures.rowsMode,
    density: figures.density,
    pages: figures.pages.map((page) => page.map((row) => toRowView(row, figures.total))),
    total: formatNumber(figures.total),
    band,
  };
  return {
    ok: true,
    snapshot,
    figures: {
      distanceKm: snapshot.km,
      elevationGainM: snapshot.dplus,
      objectives: figures.objectives.map((objective) => objective.label),
      perHour: figures.objectives.map((objective) => objective.carbsPerHour),
      totals: figures.objectives.map((objective) => objective.totalCarbsG),
      middleTotal: figures.total,
      stationCount: snapshot.stationCount,
    },
  };
};
