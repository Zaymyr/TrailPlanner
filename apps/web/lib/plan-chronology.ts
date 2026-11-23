import {
  DEFAULT_PLAN_VALUES,
  buildContinuousIntakeTimeline,
  buildContinuousSections,
  buildInitialPlanValues,
  buildPlanSectionSummary,
  buildSectionTimelineFromContinuous,
  compactPlanTimeline,
  getBaseSpeedKph,
  type AidStationFormItem,
  type IntakeTimelineItem,
  type PlanFormValues,
  type PlanProduct,
} from "@trailplanner/shared";

import type { ElevationPoint, FormValues } from "../app/(planner)/race-planner/types";
import type { FuelProduct } from "./product-types";

// Web adapter for the planner « Chronologie » tab. The calculation itself is the shared
// plan-timeline engine (packages/shared/src/plan-timeline) also used by the mobile Chronologie
// view: this file only maps web planner values onto the engine input and flattens its output.

export type ChronologyEvent = {
  minute: number;
  label: string;
  detail: string;
  kind: "carbs" | "water" | "sodium" | "mixed";
};

export type ChronologySection = {
  key: string;
  fromName: string;
  toName: string;
  startMinute: number;
  durationMin: number;
  distanceKm: number;
  dPlus: number;
  dMinus: number;
  events: ChronologyEvent[];
};

export type PlanChronologyInput = {
  values: FormValues;
  elevationProfile: ElevationPoint[];
  products: FuelProduct[];
  startName: string;
  finishName: string;
};

/**
 * Maps web planner values onto the shared engine's values, applying the same normalization as the
 * mobile app when it loads a stored plan (`normalizeStoredPlanValues` → `buildInitialPlanValues`):
 * explicit Départ / Arrivée stations, refill flags defaulting to true, no supplies where assistance
 * is not allowed, clamped fatigue.
 */
export function toPlanTimelineValues(values: FormValues): PlanFormValues {
  const aidStations: AidStationFormItem[] = (Array.isArray(values.aidStations) ? values.aidStations : []).map(
    (station) => ({
      name: station.name,
      distanceKm: station.distanceKm,
      sourceAidStationId: station.sourceAidStationId,
      maxStopMinutes: station.maxStopMinutes,
      waterRefill: station.waterRefill !== false,
      solidRefill: station.solidRefill,
      assistanceAllowed: station.assistanceAllowed,
      pauseMinutes: station.pauseMinutes,
      supplies: station.supplies,
    }),
  );

  return buildInitialPlanValues({
    ...DEFAULT_PLAN_VALUES,
    raceDistanceKm: values.raceDistanceKm ?? DEFAULT_PLAN_VALUES.raceDistanceKm,
    elevationGain: values.elevationGain ?? DEFAULT_PLAN_VALUES.elevationGain,
    fatigueLevel: values.fatigueLevel ?? DEFAULT_PLAN_VALUES.fatigueLevel,
    paceType: values.paceType ?? DEFAULT_PLAN_VALUES.paceType,
    paceMinutes: values.paceMinutes ?? DEFAULT_PLAN_VALUES.paceMinutes,
    paceSeconds: values.paceSeconds ?? DEFAULT_PLAN_VALUES.paceSeconds,
    speedKph: values.speedKph ?? DEFAULT_PLAN_VALUES.speedKph,
    targetIntakePerHour: values.targetIntakePerHour ?? DEFAULT_PLAN_VALUES.targetIntakePerHour,
    waterIntakePerHour: values.waterIntakePerHour ?? DEFAULT_PLAN_VALUES.waterIntakePerHour,
    sodiumIntakePerHour: values.sodiumIntakePerHour ?? DEFAULT_PLAN_VALUES.sodiumIntakePerHour,
    waterBagLiters: values.waterBagLiters ?? DEFAULT_PLAN_VALUES.waterBagLiters,
    startSupplies: Array.isArray(values.startSupplies) ? values.startSupplies : [],
    aidStations,
    sectionSegments: values.sectionSegments ?? values.segments,
  });
}

/** Web catalogue products keyed by id, in the engine's (database column) product shape. */
export function toPlanTimelineProductMap(products: FuelProduct[]): Record<string, PlanProduct> {
  return Object.fromEntries(
    products.map((product) => [
      product.id,
      {
        id: product.id,
        name: product.name,
        brand: product.brand ?? null,
        image_url: product.imageUrl ?? null,
        fuel_type: product.fuelType,
        carbs_g: product.carbsGrams,
        sodium_mg: product.sodiumMg,
        calories_kcal: product.caloriesKcal,
        created_by: product.createdBy ?? null,
        is_official: product.isOfficial ?? null,
      } satisfies PlanProduct,
    ]),
  );
}

/** carbs > 0 → carbs; sodium only → sodium; water only → water; anything else (e.g. electrolyte drink) → mixed. */
export function getChronologyEventKind(item: IntakeTimelineItem): ChronologyEvent["kind"] {
  const products = item.products ?? [];
  const carbs = item.carbsGrams ?? products.reduce((sum, product) => sum + product.carbsGrams, 0);
  const sodium = item.sodiumMg ?? products.reduce((sum, product) => sum + product.sodiumMg, 0);
  const water = item.waterMl ?? products.reduce((sum, product) => sum + product.waterMl, 0);

  if (carbs > 0) return "carbs";
  if (sodium > 0 && water <= 0) return "sodium";
  if (water > 0 && sodium <= 0) return "water";
  return "mixed";
}

export function buildPlanChronology(input: PlanChronologyInput): ChronologySection[] {
  const values = toPlanTimelineValues(input.values);
  const elevationProfile = input.elevationProfile ?? [];
  const productMap = toPlanTimelineProductMap(input.products ?? []);
  const baseSpeedKph = getBaseSpeedKph(values);

  // Same calls, in the same order, as the mobile plan editor (PlanForm → AidStationsSectionV3).
  const sections = buildContinuousSections({ values, elevationProfile });
  const timeline = buildContinuousIntakeTimeline({ values, productMap, elevationProfile });
  const lastIndex = sections.length - 1;

  return sections.map((section, index) => {
    const summary = buildPlanSectionSummary({ values, elevationProfile, baseSpeedKph, target: section.target });
    const segmentStats = summary?.segmentStats ?? [];
    const sectionTimeline = compactPlanTimeline(buildSectionTimelineFromContinuous(timeline, section));

    return {
      key: `section-${section.sectionIndex}`,
      fromName: index === 0 ? input.startName : section.fromName,
      toName: index === lastIndex ? input.finishName : section.toName,
      startMinute: section.startMinute,
      durationMin: section.durationMin,
      distanceKm: section.distanceKm,
      dPlus: segmentStats.reduce((sum, stat) => sum + Math.max(0, stat.dPlus), 0),
      dMinus: segmentStats.reduce((sum, stat) => sum + Math.max(0, stat.dMinus), 0),
      events: sectionTimeline.map((item) => ({
        minute: section.startMinute + item.minute,
        label: item.label,
        detail: item.detail,
        kind: getChronologyEventKind(item),
      })),
    };
  });
}

/** Time window of one web planner section (from the timeline segments, pauses and pace overrides included). */
export type ChronologySectionWindow = { startMinute: number; durationMin: number; fromName: string; toName: string };

/**
 * Re-times the shared engine's sections onto the web timeline: the engine does not know the web per-section
 * pace adjustments, so each section's events keep their relative position inside the section and are scaled
 * to the web section window. The three views then never disagree on passage times or names.
 */
export function alignChronologyToSections(
  sections: ChronologySection[],
  windows: ChronologySectionWindow[],
): ChronologySection[] {
  return sections.map((section, index) => {
    const window = windows[index];
    if (!window) return section;
    const ratio = section.durationMin > 0 ? window.durationMin / section.durationMin : 1;
    return {
      ...section,
      fromName: window.fromName,
      toName: window.toName,
      startMinute: window.startMinute,
      durationMin: window.durationMin,
      events: section.events.map((event) => ({
        ...event,
        minute: Math.round(window.startMinute + Math.max(0, event.minute - section.startMinute) * ratio),
      })),
    };
  });
}
