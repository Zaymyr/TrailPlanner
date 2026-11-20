import {
  REFERENCE_FLAT_PACES,
  estimateCourseTime,
  type QuickEstimateCourse,
} from "../../app/(planner)/race-planner/utils/quick-estimate";
import { estimateCarbs } from "../carb-calculator";
import { calculateNutrition } from "../nutrition";
import { formatObjective } from "./carousel-format";

/**
 * Figures of « Le plan chiffré » (pure). Nothing here is a new model: the three objectives are the
 * public course page's reference levels (`REFERENCE_FLAT_PACES` through `estimateCourseTime`, the
 * planner's effort model), carbohydrates per hour come from the public carb calculator
 * (`estimateCarbs`), water and sodium from the onboarding estimate (`calculateNutrition`).
 * See docs/05-integrations/instagram-carousels.md (« Numbers »).
 */

/**
 * Digestive tolerance used for each reference level in `estimateCarbs` (0-100 scale of the carb
 * calculator). A confirmed runner has usually trained their gut more than a beginner: 75 / 50 / 25.
 */
export const OBJECTIVE_TOLERANCE: Record<(typeof REFERENCE_FLAT_PACES)[number]["key"], number> = {
  confirmed: 75,
  regular: 50,
  discovery: 25,
};

/** Up to this many sections the rows are tall; up to the compact limit they fit on one line. */
export const TALL_ROWS_MAX = 6;
export const COMPACT_ROWS_MAX = 14;
/** Sections shorter than this are merged into the next one when there are too many. */
export const MERGE_SECTION_UNDER_KM = 5;
/** Hour-by-hour rows when the race has no aid station: at most this many blocks. */
export const HOUR_ROWS_MAX = 12;
/** Grams are rounded to this step; the sections always add up to the total. */
export const GRAM_STEP = 5;

export type CarouselObjective = {
  key: string;
  level: string;
  hours: number;
  label: string;
  carbsPerHour: number;
  waterMlPerHour: number;
  sodiumMgPerHour: number;
  totalCarbsG: number;
};

export type PlanRow = {
  fromKm: number;
  toKm: number;
  lengthKm: number;
  /** Hour-by-hour rows only: elapsed hours at both ends. */
  fromHour: number | null;
  toHour: number | null;
  grams: number;
  /** Grams eaten before this row, and after it (cumulative gauge). */
  doneBefore: number;
  cumul: number;
};

export type SentencePart = { text: string; strong?: boolean };

export type PlanNutrition = {
  objectives: CarouselObjective[];
  middleIndex: number;
  /** "60–80" (g/h), or a single figure when all objectives agree. */
  rangeLabel: string;
  rowsMode: "sections" | "hours";
  density: "tall" | "compact";
  /** One page of rows for slide 3, two when a fourth slide is needed. */
  pages: PlanRow[][];
  total: number;
  sentence: SentencePart[];
  /** Elapsed seconds of the middle objective at each kilometre (rounded objective), for the sky. */
  timeline: Array<{ km: number; seconds: number }>;
};

export type PlanNutritionResult = { ok: true; value: PlanNutrition } | { ok: false; reason: string };

/** Objective times are rounded like a runner states them: whole hours from 5 h, half hours below. */
export const roundObjectiveHours = (seconds: number) => {
  const hours = seconds / 3_600;
  return hours >= 5 ? Math.round(hours) : Math.max(0.5, Math.round(hours * 2) / 2);
};

const roundToStep = (value: number, step = GRAM_STEP) => Math.round(value / step) * step;

/**
 * Splits `total` (a multiple of 5) into multiples of 5 proportional to `weights`, by largest
 * remainder: the parts always add up to the total exactly.
 */
export const allocateGrams = (weights: number[], total: number, step = GRAM_STEP) => {
  const sum = weights.reduce((acc, value) => acc + Math.max(0, value), 0);
  if (!weights.length) return [];
  if (sum <= 0) return weights.map((_, index) => (index === weights.length - 1 ? total : 0));
  const exact = weights.map((value) => (Math.max(0, value) / sum) * (total / step));
  const base = exact.map(Math.floor);
  let remaining = total / step - base.reduce((acc, value) => acc + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let cursor = 0; remaining > 0 && cursor < order.length; cursor += 1, remaining -= 1) base[order[cursor].index] += 1;
  return base.map((units) => units * step);
};

type Leg = { fromKm: number; toKm: number; seconds: number };

/** Rule « au-delà » : a section under 5 km is merged into the next one (the last into the previous). */
export const mergeShortLegs = (legs: Leg[], minKm = MERGE_SECTION_UNDER_KM): Leg[] => {
  const merged: Leg[] = [];
  let pending: Leg | null = null;
  for (const leg of legs) {
    const current: Leg = pending ? { fromKm: pending.fromKm, toKm: leg.toKm, seconds: pending.seconds + leg.seconds } : leg;
    pending = null;
    if (current.toKm - current.fromKm < minKm) pending = current;
    else merged.push(current);
  }
  if (pending) {
    const last = merged.pop();
    merged.push(last ? { fromKm: last.fromKm, toKm: pending.toKm, seconds: last.seconds + pending.seconds } : pending);
  }
  return merged;
};

const withCumul = (rows: Array<Omit<PlanRow, "doneBefore" | "cumul">>): PlanRow[] => {
  let cumul = 0;
  return rows.map((row) => {
    const doneBefore = cumul;
    cumul += row.grams;
    return { ...row, doneBefore, cumul };
  });
};

/** Elapsed seconds at `km` along a timeline (linear between its points). */
export const secondsAtKm = (timeline: Array<{ km: number; seconds: number }>, km: number) => {
  if (!timeline.length) return 0;
  if (km <= timeline[0].km) return timeline[0].seconds;
  for (let index = 1; index < timeline.length; index += 1) {
    const next = timeline[index];
    if (km <= next.km) {
      const previous = timeline[index - 1];
      const span = next.km - previous.km;
      return previous.seconds + (span > 0 ? ((km - previous.km) / span) * (next.seconds - previous.seconds) : 0);
    }
  }
  return timeline[timeline.length - 1].seconds;
};

/** Kilometre reached after `seconds` along a timeline. */
export const kmAtSeconds = (timeline: Array<{ km: number; seconds: number }>, seconds: number) => {
  if (!timeline.length) return 0;
  if (seconds <= timeline[0].seconds) return timeline[0].km;
  for (let index = 1; index < timeline.length; index += 1) {
    const next = timeline[index];
    if (seconds <= next.seconds) {
      const previous = timeline[index - 1];
      const span = next.seconds - previous.seconds;
      return previous.km + (span > 0 ? ((seconds - previous.seconds) / span) * (next.km - previous.km) : 0);
    }
  }
  return timeline[timeline.length - 1].km;
};

/** Sections between start, aid stations and finish; density, merge and fourth-slide rules. */
export const buildSectionPages = (legs: Leg[], gramsPerHour: number, total: number): { density: PlanNutrition["density"]; pages: PlanRow[][] } => {
  const usable = legs.length > COMPACT_ROWS_MAX ? mergeShortLegs(legs) : legs;
  const grams = allocateGrams(usable.map((leg) => (gramsPerHour * leg.seconds) / 3_600), total);
  const rows = withCumul(usable.map((leg, index) => ({
    fromKm: leg.fromKm,
    toKm: leg.toKm,
    lengthKm: leg.toKm - leg.fromKm,
    fromHour: null,
    toHour: null,
    grams: grams[index],
  })));
  if (rows.length <= TALL_ROWS_MAX) return { density: "tall", pages: [rows] };
  if (rows.length <= COMPACT_ROWS_MAX) return { density: "compact", pages: [rows] };
  const half = Math.ceil(rows.length / 2);
  return { density: "compact", pages: [rows.slice(0, half), rows.slice(half)] };
};

/** No aid station: « heure par heure », in blocks of whole hours so there are 12 rows at most. */
export const buildHourPages = (hours: number, timeline: Array<{ km: number; seconds: number }>, gramsPerHour: number, total: number) => {
  const block = Math.max(1, Math.ceil(hours / HOUR_ROWS_MAX));
  const bounds: number[] = [];
  for (let hour = 0; hour < hours; hour += block) bounds.push(hour);
  bounds.push(hours);
  const spans = bounds.slice(1).map((end, index) => ({ from: bounds[index], to: end }));
  const grams = allocateGrams(spans.map((span) => gramsPerHour * (span.to - span.from)), total);
  const rows = withCumul(spans.map((span, index) => {
    const fromKm = kmAtSeconds(timeline, span.from * 3_600);
    const toKm = kmAtSeconds(timeline, span.to * 3_600);
    return { fromKm, toKm, lengthKm: toKm - fromKm, fromHour: span.from, toHour: span.to, grams: grams[index] };
  }));
  return { density: (rows.length <= TALL_ROWS_MAX ? "tall" : "compact") as PlanNutrition["density"], pages: [rows] };
};

const isNonIncreasing = (values: number[]) => values.every((value, index) => index === 0 || value <= values[index - 1]);
const isNonDecreasing = (values: number[]) => values.every((value, index) => index === 0 || value >= values[index - 1]);

/**
 * The sentence under the table, true for these figures only: the per-hour part when the faster
 * objective eats more per hour, the total part when a longer objective eats more in total.
 */
export const buildSentence = (objectives: CarouselObjective[]): SentencePart[] => {
  const perHour = objectives.map((objective) => objective.carbsPerHour);
  const totals = objectives.map((objective) => objective.totalCarbsG);
  const fasterEatsMore = isNonIncreasing(perHour) && perHour[0] > perHour[perHour.length - 1];
  const sameRate = perHour.every((value) => value === perHour[0]);
  const longerEatsMore = isNonDecreasing(totals) && totals[0] < totals[totals.length - 1];
  if (fasterEatsMore && longerEatsMore) {
    return [
      { text: "Plus tu vas vite, plus tu dois manger " }, { text: "par heure", strong: true },
      { text: ". Plus tu restes dehors, plus le " }, { text: "total", strong: true }, { text: " grimpe." },
    ];
  }
  if (fasterEatsMore) {
    return [{ text: "Plus tu vas vite, plus tu dois manger " }, { text: "par heure", strong: true }, { text: "." }];
  }
  if (sameRate && longerEatsMore) {
    return [
      { text: "Même rythme " }, { text: "par heure", strong: true },
      { text: " : c’est le temps passé dehors qui fait grimper le " }, { text: "total", strong: true }, { text: "." },
    ];
  }
  if (longerEatsMore) return [{ text: "Plus tu restes dehors, plus le " }, { text: "total", strong: true }, { text: " grimpe." }];
  return [{ text: "Le bon chiffre dépend de ton objectif : choisis ta ligne." }];
};

/** A 1-km timeline of the effort model, scaled so it ends exactly at the rounded objective. */
const buildTimeline = (course: QuickEstimateCourse, flatPace: number, totalKm: number, objectiveSeconds: number) => {
  const grid = Array.from({ length: Math.max(0, Math.ceil(totalKm) - 1) }, (_, index) => ({ name: "", distanceKm: index + 1 }))
    .filter((point) => point.distanceKm < totalKm);
  const fine = estimateCourseTime({ ...course, aidStations: grid }, flatPace);
  if (!fine || fine.totalSeconds <= 0) return null;
  const scale = objectiveSeconds / fine.totalSeconds;
  return [{ km: 0, seconds: 0 }, ...fine.checkpoints.map((checkpoint) => ({ km: checkpoint.distanceKm, seconds: checkpoint.elapsedSeconds * scale }))];
};

/**
 * The three objectives and every figure of the strip, or why the race cannot be covered: no
 * distance or D+, a model that returns nothing, or objectives too close to tell apart. Section
 * grams are the middle objective's carbs per hour × the estimated duration of each section.
 */
export const computePlanNutrition = (course: QuickEstimateCourse): PlanNutritionResult => {
  const distanceKm = course.distanceKm;
  if (distanceKm === null || !(distanceKm > 0)) return { ok: false, reason: "Distance inconnue." };
  if (course.elevationGainM === null || !(course.elevationGainM >= 0)) return { ok: false, reason: "D+ inconnu." };

  const estimates = REFERENCE_FLAT_PACES.map((level) => ({ level, result: estimateCourseTime(course, level.flatPaceMinPerKm) }));
  if (estimates.some((entry) => !entry.result || entry.result.totalSeconds <= 0)) return { ok: false, reason: "Le modèle d’allure ne donne pas de temps." };

  const water = calculateNutrition(distanceKm, course.elevationGainM, "good_time");
  const objectives: CarouselObjective[] = estimates.map(({ level, result }) => {
    const hours = roundObjectiveHours((result as NonNullable<typeof result>).totalSeconds);
    const carbs = estimateCarbs({ durationHours: hours, digestiveTolerance: OBJECTIVE_TOLERANCE[level.key] });
    return {
      key: level.key,
      level: level.label,
      hours,
      label: formatObjective(hours),
      carbsPerHour: carbs.carbsPerHour,
      waterMlPerHour: water.waterPerHour,
      sodiumMgPerHour: water.sodiumPerHour,
      totalCarbsG: roundToStep(carbs.carbsPerHour * hours),
    };
  });
  if (new Set(objectives.map((objective) => objective.label)).size !== objectives.length) return { ok: false, reason: "Objectifs trop proches pour être distingués." };
  if (objectives.some((objective) => objective.carbsPerHour <= 0)) return { ok: false, reason: "Course trop courte pour un apport en glucides." };

  const middleIndex = 1;
  const middle = objectives[middleIndex];
  const middleEstimate = estimates[middleIndex].result as NonNullable<(typeof estimates)[number]["result"]>;
  const objectiveSeconds = middle.hours * 3_600;
  const timeline = buildTimeline(course, middleEstimate.flatPaceMinPerKm, distanceKm, objectiveSeconds);
  if (!timeline) return { ok: false, reason: "Le modèle d’allure ne donne pas de temps." };

  // Sections follow the same checkpoints as the objective, rescaled to the rounded objective.
  const scale = objectiveSeconds / middleEstimate.totalSeconds;
  let previous = { km: 0, seconds: 0 };
  const legs: Leg[] = middleEstimate.checkpoints.map((checkpoint) => {
    const leg = { fromKm: previous.km, toKm: checkpoint.distanceKm, seconds: (checkpoint.elapsedSeconds - previous.seconds) * scale };
    previous = { km: checkpoint.distanceKm, seconds: checkpoint.elapsedSeconds };
    return leg;
  });

  const hasStations = legs.length > 1;
  const layout = hasStations
    ? buildSectionPages(legs, middle.carbsPerHour, middle.totalCarbsG)
    : buildHourPages(middle.hours, timeline, middle.carbsPerHour, middle.totalCarbsG);
  const perHour = objectives.map((objective) => objective.carbsPerHour);
  const low = Math.min(...perHour);
  const high = Math.max(...perHour);

  return {
    ok: true,
    value: {
      objectives,
      middleIndex,
      rangeLabel: low === high ? String(low) : `${low}–${high}`,
      rowsMode: hasStations ? "sections" : "hours",
      density: layout.density,
      pages: layout.pages,
      total: middle.totalCarbsG,
      sentence: buildSentence(objectives),
      timeline,
    },
  };
};
