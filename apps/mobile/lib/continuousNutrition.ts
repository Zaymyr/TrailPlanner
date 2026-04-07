import type {
  AidStationFormItem,
  IntakeTimelineItem,
  PlanFormValues,
  PlanProduct,
  PlanTarget,
  SectionTarget,
  Supply,
} from '../components/plan-form/contracts';
import {
  DEFAULT_FLUID_MIX_SHARE,
  DEFAULT_FLUID_PRODUCT_VOLUME_ML,
} from '../components/plan-form/contracts';
import { buildPlanSectionSummary, getBaseSpeedKph } from '../components/plan-form/section-summary';
import type { ElevationPoint } from '../components/plan-form/profile-utils';

export type ContinuousSection = {
  target: PlanTarget;
  sectionIndex: number;
  fromName: string;
  toName: string;
  startKm: number;
  endKm: number;
  distanceKm: number;
  durationMin: number;
  startMinute: number;
  endMinute: number;
  targetCarbsG: number;
  targetSodiumMg: number;
  targetWaterMl: number;
  supplies: Supply[];
  waterRefill: boolean;
};

export type ContinuousIntakeEvent = IntakeTimelineItem & {
  id: string;
  absoluteMinute: number;
  sectionIndex: number;
  sectionTarget: PlanTarget;
  fromName: string;
  toName: string;
  startKm: number;
  endKm: number;
};

type SolidCandidate = {
  productId?: string;
  label: string;
  carbs: number;
  sodium: number;
};

type AvailableSolidUnit = SolidCandidate & {
  availableFromMinute: number;
  unitId?: string;
};

export type SuggestedSolidIntake = {
  productId?: string;
  label: string;
  carbs: number;
  sodium: number;
  absoluteMinute: number;
  sectionIndex: number;
  target: PlanTarget;
};

type BuildSectionsArgs = {
  values: PlanFormValues;
  elevationProfile?: ElevationPoint[];
};

type BuildTimelineArgs = {
  values: PlanFormValues;
  productMap: Record<string, PlanProduct>;
  elevationProfile?: ElevationPoint[];
  waterOnlyReminderIntervalMinutes?: WaterOnlyReminderIntervalMinutes;
};

export const WATER_ONLY_REMINDER_INTERVALS = [5, 10, 15] as const;
export type WaterOnlyReminderIntervalMinutes = (typeof WATER_ONLY_REMINDER_INTERVALS)[number];

export const DEFAULT_WATER_ONLY_REMINDER_INTERVAL_MIN: WaterOnlyReminderIntervalMinutes = 10;

const MAX_DRINK_INTERVAL_MIN = DEFAULT_WATER_ONLY_REMINDER_INTERVAL_MIN;
const TARGET_DRINK_SIP_ML = 140;
const TIMELINE_ROUNDING_STEP_MIN = 5;
const MIN_SOLID_INTERVAL_MIN = 15;
const MIN_NOTIFICATION_GAP_MIN = 4;
const MIN_CARB_DEFICIT_BEFORE_SOLID_G = 16;
const FIRST_SOLID_MIN = 20;
const MAX_SOLID_GAP_MIN = 30;

function isFluidProduct(product: PlanProduct | undefined) {
  return product?.fuel_type === 'drink_mix' || product?.fuel_type === 'electrolyte';
}

function getSuppliesForTarget(values: PlanFormValues, target: PlanTarget) {
  return target === 'start' ? values.startSupplies ?? [] : values.aidStations[target]?.supplies ?? [];
}

function getAvailableWaterMl(section: ContinuousSection, waterBagLiters: number) {
  return section.waterRefill ? waterBagLiters * 1000 : 0;
}

function roundToStep(minute: number, step = TIMELINE_ROUNDING_STEP_MIN) {
  return Math.max(0, Math.round(minute / step) * step);
}

function clampMinute(minute: number, minMinute: number, maxMinute: number) {
  return Math.min(maxMinute, Math.max(minMinute, minute));
}

function distributeIntegerTotal(total: number, count: number): number[] {
  const safeCount = Math.max(1, count);
  const safeTotal = Math.max(0, Math.round(total));
  const baseValue = Math.floor(safeTotal / safeCount);
  const remainder = safeTotal - baseValue * safeCount;
  return Array.from({ length: safeCount }, (_, index) => baseValue + (index < remainder ? 1 : 0));
}

function buildAbsoluteDrinkSlots(startMinute: number, endMinute: number) {
  const slots: number[] = [];
  const safeStart = Math.max(0, Math.floor(startMinute));
  const safeEnd = Math.max(safeStart, Math.round(endMinute));
  let minute = Math.max(1, Math.ceil(safeStart / MAX_DRINK_INTERVAL_MIN) * MAX_DRINK_INTERVAL_MIN);

  if (minute > safeEnd) {
    const midpoint = Math.min(safeEnd, Math.max(safeStart + 1, Math.round((safeStart + safeEnd) / 2)));
    return [midpoint];
  }

  while (minute <= safeEnd) {
    slots.push(minute);
    minute += MAX_DRINK_INTERVAL_MIN;
  }

  if (slots.length === 0) {
    slots.push(Math.min(safeEnd, Math.max(safeStart + 1, safeEnd)));
  } else if (slots[slots.length - 1] !== safeEnd && safeEnd - slots[slots.length - 1] > MAX_DRINK_INTERVAL_MIN / 2) {
    slots.push(safeEnd);
  }

  return slots;
}

function buildConfiguredWaterOnlySlots(
  startMinute: number,
  endMinute: number,
  intervalMinutes: WaterOnlyReminderIntervalMinutes,
) {
  const slots: number[] = [];
  const safeStart = Math.max(0, roundToStep(startMinute));
  const safeEnd = Math.max(safeStart + 1, roundToStep(endMinute));
  const targetCount = Math.max(1, Math.ceil((safeEnd - safeStart) / intervalMinutes));
  let minute = safeStart + intervalMinutes;

  while (minute <= safeEnd) {
    slots.push(roundToStep(minute));
    minute += intervalMinutes;
  }

  if (slots.length < targetCount && slots[slots.length - 1] !== safeEnd) {
    slots.push(safeEnd);
  }

  if (slots.length === 0) {
    return [Math.min(safeEnd, Math.max(safeStart + 1, roundToStep((safeStart + safeEnd) / 2)))];
  }

  return slots.slice(0, targetCount);
}

function mergeCloseEvents(events: ContinuousIntakeEvent[]) {
  if (events.length <= 1) return events;

  const sorted = [...events].sort((a, b) => a.absoluteMinute - b.absoluteMinute);
  const merged: ContinuousIntakeEvent[] = [];

  sorted.forEach((event) => {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push(event);
      return;
    }

    const shouldMerge =
      event.absoluteMinute - previous.absoluteMinute <= MIN_NOTIFICATION_GAP_MIN &&
      (event.waterMl ?? 0) > 0 !== (previous.waterMl ?? 0) > 0;

    if (!shouldMerge) {
      merged.push(event);
      return;
    }

    const combinedProducts = [...(previous.products ?? []), ...(event.products ?? [])];
    const combinedLabel =
      previous.label === 'Eau'
        ? `${event.label} + Eau`
        : event.label === 'Eau'
          ? `${previous.label} + Eau`
          : `${previous.label} + ${event.label}`;
    const detailParts = [
      (previous.waterMl ?? 0) + (event.waterMl ?? 0) > 0
        ? `${(previous.waterMl ?? 0) + (event.waterMl ?? 0)} ml`
        : null,
      (previous.carbsGrams ?? 0) + (event.carbsGrams ?? 0) > 0
        ? `${(previous.carbsGrams ?? 0) + (event.carbsGrams ?? 0)}g glucides`
        : null,
      (previous.sodiumMg ?? 0) + (event.sodiumMg ?? 0) > 0
        ? `${(previous.sodiumMg ?? 0) + (event.sodiumMg ?? 0)}mg sodium`
        : null,
    ].filter((part): part is string => part !== null);

    merged[merged.length - 1] = {
      ...previous,
      id: previous.id,
      label: combinedLabel,
      detail: detailParts.join(' - '),
      carbsGrams: (previous.carbsGrams ?? 0) + (event.carbsGrams ?? 0),
      sodiumMg: (previous.sodiumMg ?? 0) + (event.sodiumMg ?? 0),
      waterMl: (previous.waterMl ?? 0) + (event.waterMl ?? 0),
      products: combinedProducts.length > 0 ? combinedProducts : undefined,
    };
  });

  return merged;
}

function getSectionForMinute(sections: ContinuousSection[], minute: number) {
  return (
    sections.find((section) => minute > section.startMinute && minute <= section.endMinute) ??
    sections[sections.length - 1] ??
    null
  );
}

function pickBestSolidCandidate(
  pool: SolidCandidate[],
  carbDeficit: number,
  usageCounts: Map<string, number>,
): SolidCandidate | null {
  let best: SolidCandidate | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  pool.forEach((candidate) => {
    if (candidate.carbs <= 0) return;

    const carbAfter = Math.max(0, carbDeficit - candidate.carbs);
    const carbOvershoot = Math.max(0, candidate.carbs - carbDeficit);
    const regularityPenalty =
      Math.abs(candidate.carbs - Math.max(carbDeficit, 0)) / Math.max(Math.max(carbDeficit, 20), 1);
    const repetitionPenalty = (usageCounts.get(candidate.productId ?? candidate.label) ?? 0) * 0.14;

    const score =
      carbAfter / Math.max(carbDeficit, 1) +
      (carbOvershoot / Math.max(carbDeficit, 20)) * 0.35 +
      regularityPenalty * 0.15 +
      repetitionPenalty;

    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  });

  return best;
}

function buildRegularSolidPlan(
  sections: ContinuousSection[],
  targetIntakePerHour: number,
  getAvailableCandidates: (minute: number, section: ContinuousSection) => SolidCandidate[],
  consumeCandidate: (minute: number, section: ContinuousSection, candidate: SolidCandidate) => void,
) {
  const events: SuggestedSolidIntake[] = [];
  const totalDuration = sections.at(-1)?.endMinute ?? 0;
  const carbRatePerMinute = Math.max(0, targetIntakePerHour / 60);
  const carbTrigger = Math.max(targetIntakePerHour / 4, MIN_CARB_DEFICIT_BEFORE_SOLID_G);
  let consumedCarbs = 0;
  let lastSolidMinute = -MAX_SOLID_GAP_MIN;
  const usageCounts = new Map<string, number>();

  for (let minute = TIMELINE_ROUNDING_STEP_MIN; minute <= Math.ceil(totalDuration); minute += TIMELINE_ROUNDING_STEP_MIN) {
    const roundedMinute = roundToStep(minute);
    const section = getSectionForMinute(sections, roundedMinute);
    if (!section) continue;
    if (roundedMinute < FIRST_SOLID_MIN) continue;
    if (roundedMinute - lastSolidMinute < MIN_SOLID_INTERVAL_MIN) continue;

    const carbDeficit = roundedMinute * carbRatePerMinute - consumedCarbs;
    const dueByDeficit = carbDeficit >= carbTrigger;
    const dueByGap = roundedMinute - lastSolidMinute >= MAX_SOLID_GAP_MIN;

    if (!dueByDeficit && !dueByGap) continue;

    const candidates = getAvailableCandidates(roundedMinute, section);
    if (candidates.length === 0) continue;

    const picked = pickBestSolidCandidate(candidates, carbDeficit, usageCounts);
    if (!picked) continue;

    consumeCandidate(roundedMinute, section, picked);
    consumedCarbs += Math.max(picked.carbs, 0);
    lastSolidMinute = roundedMinute;
    const usageKey = picked.productId ?? picked.label;
    usageCounts.set(usageKey, (usageCounts.get(usageKey) ?? 0) + 1);

    events.push({
      productId: picked.productId,
      label: picked.label,
      carbs: Math.round(picked.carbs),
      sodium: Math.round(picked.sodium),
      absoluteMinute: roundedMinute,
      sectionIndex: section.sectionIndex,
      target: section.target,
    });
  }

  return events;
}

export function buildSuggestedSolidIntakePlan(args: {
  values: PlanFormValues;
  solidProducts: Array<{
    id: string;
    name: string;
    carbs_g?: number | null;
    sodium_mg?: number | null;
  }>;
  elevationProfile?: ElevationPoint[];
}) {
  const sections = buildContinuousSections({
    values: args.values,
    elevationProfile: args.elevationProfile ?? [],
  });
  const pool: SolidCandidate[] = args.solidProducts
    .map((product) => ({
      productId: product.id,
      label: product.name,
      carbs: Math.max(product.carbs_g ?? 0, 0),
      sodium: Math.max(product.sodium_mg ?? 0, 0),
    }))
    .filter((product) => product.carbs > 0);

  const events = buildRegularSolidPlan(
    sections,
    args.values.targetIntakePerHour,
    () => pool,
    () => {},
  );

  return { sections, events };
}

function summarizeSuppliesWithFluidConstraint(
  supplies: Supply[],
  productMap: Record<string, PlanProduct>,
  availableWaterMl: number,
) {
  let solidCarbs = 0;
  let solidSodium = 0;
  const fluidEntries: Array<{
    label: string;
    carbs: number;
    sodium: number;
    requestedWaterMl: number;
    densityScore: number;
  }> = [];

  supplies.forEach((supply) => {
    const product = productMap[supply.productId];
    if (!product || supply.quantity <= 0) return;

    if (isFluidProduct(product)) {
      fluidEntries.push({
        label: product.name,
        carbs: (product.carbs_g ?? 0) * supply.quantity,
        sodium: (product.sodium_mg ?? 0) * supply.quantity,
        requestedWaterMl: DEFAULT_FLUID_PRODUCT_VOLUME_ML * supply.quantity,
        densityScore: (product.carbs_g ?? 0) + (product.sodium_mg ?? 0) / 100,
      });
      return;
    }

    solidCarbs += (product.carbs_g ?? 0) * supply.quantity;
    solidSodium += (product.sodium_mg ?? 0) * supply.quantity;
  });

  const activeFluidEntry = fluidEntries.reduce<(typeof fluidEntries)[number] | null>((best, entry) => {
    if (!best) return entry;
    if (entry.requestedWaterMl !== best.requestedWaterMl) {
      return entry.requestedWaterMl > best.requestedWaterMl ? entry : best;
    }
    if (entry.densityScore !== best.densityScore) {
      return entry.densityScore > best.densityScore ? entry : best;
    }
    return entry.label.localeCompare(best.label) < 0 ? entry : best;
  }, null);

  const fluidWaterBudgetMl = availableWaterMl * DEFAULT_FLUID_MIX_SHARE;
  const requestedFluidWaterMl = activeFluidEntry?.requestedWaterMl ?? 0;
  const effectiveFluidRatio =
    requestedFluidWaterMl > 0 ? Math.min(1, fluidWaterBudgetMl / requestedFluidWaterMl) : 0;

  return {
    totalCarbs: solidCarbs + (activeFluidEntry?.carbs ?? 0) * effectiveFluidRatio,
    totalSodium: solidSodium + (activeFluidEntry?.sodium ?? 0) * effectiveFluidRatio,
    effectiveFluidWaterMl: requestedFluidWaterMl * effectiveFluidRatio,
    effectiveFluidCarbs: (activeFluidEntry?.carbs ?? 0) * effectiveFluidRatio,
    effectiveFluidSodium: (activeFluidEntry?.sodium ?? 0) * effectiveFluidRatio,
    fluidLabels: activeFluidEntry ? [activeFluidEntry.label] : [],
  };
}

export function buildContinuousSections({
  values,
  elevationProfile = [],
}: BuildSectionsArgs): ContinuousSection[] {
  const baseSpeedKph = getBaseSpeedKph(values);
  const sections: ContinuousSection[] = [];
  let startMinute = 0;

  for (let sectionIndex = 0; sectionIndex < values.aidStations.length - 1; sectionIndex += 1) {
    const target: PlanTarget = sectionIndex === 0 ? 'start' : sectionIndex;
    const summary = buildPlanSectionSummary({
      values,
      elevationProfile,
      baseSpeedKph,
      target,
    });

    if (!summary) continue;

    const fromStation = values.aidStations[summary.sectionIndex];
    const toStation = values.aidStations[summary.sectionIndex + 1];
    const roundedStartMinute = roundToStep(startMinute);
    const roundedEndMinute = roundToStep(startMinute + summary.durationMin);

    sections.push({
      target,
      sectionIndex: summary.sectionIndex,
      fromName: fromStation?.name ?? 'Depart',
      toName: toStation?.name ?? 'Arrivee',
      startKm: summary.startKm,
      endKm: summary.endKm,
      distanceKm: summary.distanceKm,
      durationMin: summary.durationMin,
      startMinute: roundedStartMinute,
      endMinute: Math.max(roundedStartMinute + 1, roundedEndMinute),
      targetCarbsG: summary.targetCarbsG,
      targetSodiumMg: summary.targetSodiumMg,
      targetWaterMl: summary.targetWaterMl,
      supplies: getSuppliesForTarget(values, target),
      waterRefill: target === 'start' || values.aidStations[summary.sectionIndex]?.waterRefill === true,
    });

    startMinute += summary.durationMin;
  }

  return sections;
}

function buildSectionDrinkEvents(
  section: ContinuousSection,
  waterBagLiters: number,
  productMap: Record<string, PlanProduct>,
  waterOnlyReminderIntervalMinutes?: WaterOnlyReminderIntervalMinutes,
): ContinuousIntakeEvent[] {
  const availableWaterMl = getAvailableWaterMl(section, waterBagLiters);
  const totalTargetWater = Math.max(Math.min(section.targetWaterMl, availableWaterMl), 0);
  const summarized = summarizeSuppliesWithFluidConstraint(section.supplies, productMap, availableWaterMl);
  const totalFluidProductWaterMl = summarized.effectiveFluidWaterMl;
  const totalFluidCarbs = summarized.effectiveFluidCarbs;
  const totalFluidSodium = summarized.effectiveFluidSodium;
  const totalDrinkMl =
    summarized.fluidLabels.length > 0
      ? Math.max(totalTargetWater, totalFluidProductWaterMl)
      : totalTargetWater;

  if (totalDrinkMl <= 0) return [];

  const hasFluidProducts = summarized.fluidLabels.length > 0;
  const configuredWaterOnlySlots =
    !hasFluidProducts && waterOnlyReminderIntervalMinutes
      ? buildConfiguredWaterOnlySlots(section.startMinute, section.endMinute, waterOnlyReminderIntervalMinutes)
      : null;
  const baseSlotCount = Math.max(1, Math.ceil(section.durationMin / MAX_DRINK_INTERVAL_MIN));
  const slotCount = configuredWaterOnlySlots
    ? configuredWaterOnlySlots.length
    : Math.max(baseSlotCount, Math.ceil(totalDrinkMl / TARGET_DRINK_SIP_ML));
  const slotMinutes = configuredWaterOnlySlots ?? buildAbsoluteDrinkSlots(section.startMinute, section.endMinute).slice(0, slotCount);
  const adjustedSlotMinutes =
    slotMinutes.length === slotCount
      ? slotMinutes
      : Array.from({ length: slotCount }, (_, index) =>
          Math.min(
            roundToStep(section.endMinute),
            Math.max(roundToStep(section.startMinute) + 1, roundToStep(section.startMinute + ((index + 1) / slotCount) * section.durationMin)),
          ),
        );
  const fluidWaterPerSlot = distributeIntegerTotal(totalFluidProductWaterMl, slotCount);
  const plainWaterPerSlot = distributeIntegerTotal(Math.max(totalDrinkMl - totalFluidProductWaterMl, 0), slotCount);
  const carbsPerSlot = distributeIntegerTotal(totalFluidCarbs, slotCount);
  const sodiumPerSlot = distributeIntegerTotal(totalFluidSodium, slotCount);
  const fluidLabel = summarized.fluidLabels.length === 1 ? summarized.fluidLabels[0] : 'Boisson';

  const events: ContinuousIntakeEvent[] = [];

  adjustedSlotMinutes.forEach((absoluteMinute, index) => {
    const waterMl = fluidWaterPerSlot[index] + plainWaterPerSlot[index];
    const carbsGrams = carbsPerSlot[index];
    const sodiumMg = sodiumPerSlot[index];

    if (waterMl <= 0 && carbsGrams <= 0 && sodiumMg <= 0) return;

    const detailParts: string[] = [];
    if (waterMl > 0) detailParts.push(`${waterMl} ml`);
    if (carbsGrams > 0) detailParts.push(`${carbsGrams}g glucides`);
    if (sodiumMg > 0) detailParts.push(`${sodiumMg}mg sodium`);

    events.push({
      id: `section-${section.sectionIndex}-drink-${index}`,
      minute: Math.max(0, roundToStep(absoluteMinute - section.startMinute)),
      absoluteMinute: roundToStep(absoluteMinute),
      sectionIndex: section.sectionIndex,
      sectionTarget: section.target,
      fromName: section.fromName,
      toName: section.toName,
      startKm: section.startKm,
      endKm: section.endKm,
      label: summarized.fluidLabels.length > 0 ? fluidLabel : 'Eau',
      detail: detailParts.join(' - '),
      carbsGrams,
      sodiumMg,
      waterMl,
      products:
        summarized.fluidLabels.length > 0
          ? [
              {
                name: fluidLabel,
                quantity: 1,
                carbsGrams,
                sodiumMg,
                waterMl,
              },
            ]
          : undefined,
    });
  });

  return events;
}

export function buildContinuousIntakeTimeline({
  values,
  productMap,
  elevationProfile = [],
  waterOnlyReminderIntervalMinutes,
}: BuildTimelineArgs): ContinuousIntakeEvent[] {
  const sections = buildContinuousSections({ values, elevationProfile });
  const allEvents: ContinuousIntakeEvent[] = [];
  const remainingUnits: AvailableSolidUnit[] = sections.flatMap((section) =>
    section.supplies.flatMap((supply) => {
      const product = productMap[supply.productId];
      if (!product || supply.quantity <= 0 || isFluidProduct(product)) return [];

      return Array.from({ length: supply.quantity }, (_, index) => ({
        productId: supply.productId,
        label: product.name,
        carbs: Math.max(product.carbs_g ?? 0, 0),
        sodium: Math.max(product.sodium_mg ?? 0, 0),
        availableFromMinute: roundToStep(section.startMinute),
        unitId: `${section.sectionIndex}-${supply.productId}-${index}`,
      }));
    }),
  );

  const solidEvents = buildRegularSolidPlan(
    sections,
    values.targetIntakePerHour,
    (minute) =>
      remainingUnits
        .filter((unit) => unit.availableFromMinute <= minute)
        .filter((unit) => unit.carbs > 0)
        .map((unit) => ({
          productId: unit.productId,
          label: unit.label,
          carbs: unit.carbs,
          sodium: unit.sodium,
        })),
    (minute, section, candidate) => {
      const unitIndex = remainingUnits.findIndex(
        (unit) =>
          unit.availableFromMinute <= minute &&
          unit.productId === candidate.productId &&
          unit.label === candidate.label &&
          unit.carbs === candidate.carbs &&
          unit.sodium === candidate.sodium,
      );
      if (unitIndex >= 0) remainingUnits.splice(unitIndex, 1);

      const detailParts: string[] = [];
      if (candidate.carbs > 0) detailParts.push(`${Math.round(candidate.carbs)}g glucides`);
      if (candidate.sodium > 0) detailParts.push(`${Math.round(candidate.sodium)}mg sodium`);

      allEvents.push({
        id: `section-${section.sectionIndex}-solid-${allEvents.length}`,
        minute: Math.max(0, roundToStep(minute - section.startMinute)),
        absoluteMinute: minute,
        sectionIndex: section.sectionIndex,
        sectionTarget: section.target,
        fromName: section.fromName,
        toName: section.toName,
        startKm: section.startKm,
        endKm: section.endKm,
        label: candidate.label,
        detail: detailParts.length > 0 ? detailParts.join(' - ') : '1 prise',
        carbsGrams: Math.round(candidate.carbs),
        sodiumMg: Math.round(candidate.sodium),
        waterMl: 0,
        products: [
          {
            name: candidate.label,
            quantity: 1,
            carbsGrams: Math.round(candidate.carbs),
            sodiumMg: Math.round(candidate.sodium),
            waterMl: 0,
          },
        ],
      });
    },
  );

  void solidEvents;

  sections.forEach((section) => {
    allEvents.push(...buildSectionDrinkEvents(section, values.waterBagLiters, productMap, waterOnlyReminderIntervalMinutes));
  });

  return mergeCloseEvents(
    allEvents.sort((a, b) => {
      if (a.absoluteMinute !== b.absoluteMinute) return a.absoluteMinute - b.absoluteMinute;
      if ((a.label === 'Eau' ? 1 : 0) !== (b.label === 'Eau' ? 1 : 0)) {
        return (a.label === 'Eau' ? 1 : 0) - (b.label === 'Eau' ? 1 : 0);
      }
      return a.label.localeCompare(b.label);
    }),
  );
}

export function buildSectionTimelineFromContinuous(
  timeline: ContinuousIntakeEvent[],
  section: ContinuousSection,
): IntakeTimelineItem[] {
  return timeline
    .filter(
      (event) =>
        event.sectionIndex === section.sectionIndex &&
        event.absoluteMinute >= section.startMinute &&
        event.absoluteMinute <= section.endMinute,
    )
    .map((event) => ({
      minute: Math.max(0, Math.round(event.absoluteMinute - section.startMinute)),
      label: event.label,
      detail: event.detail,
      carbsGrams: event.carbsGrams,
      sodiumMg: event.sodiumMg,
      waterMl: event.waterMl,
      products: event.products,
      immediate: event.immediate,
    }));
}

export function buildSectionTargetFromContinuous(section: ContinuousSection): SectionTarget {
  return {
    targetCarbsG: section.targetCarbsG,
    targetSodiumMg: section.targetSodiumMg,
    targetWaterMl: section.targetWaterMl,
  };
}
