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

type BuildSectionsArgs = {
  values: PlanFormValues;
  elevationProfile?: ElevationPoint[];
};

type BuildTimelineArgs = {
  values: PlanFormValues;
  productMap: Record<string, PlanProduct>;
  elevationProfile?: ElevationPoint[];
};

const MAX_DRINK_INTERVAL_MIN = 10;
const TARGET_DRINK_SIP_ML = 140;

function isFluidProduct(product: PlanProduct | undefined) {
  return product?.fuel_type === 'drink_mix' || product?.fuel_type === 'electrolyte';
}

function getSuppliesForTarget(values: PlanFormValues, target: PlanTarget) {
  return target === 'start' ? values.startSupplies ?? [] : values.aidStations[target]?.supplies ?? [];
}

function getAvailableWaterMl(section: ContinuousSection, waterBagLiters: number) {
  return section.waterRefill ? waterBagLiters * 1000 : 0;
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
    const endMinute = startMinute + summary.durationMin;

    sections.push({
      target,
      sectionIndex: summary.sectionIndex,
      fromName: fromStation?.name ?? 'Depart',
      toName: toStation?.name ?? 'Arrivee',
      startKm: summary.startKm,
      endKm: summary.endKm,
      distanceKm: summary.distanceKm,
      durationMin: summary.durationMin,
      startMinute,
      endMinute,
      targetCarbsG: summary.targetCarbsG,
      targetSodiumMg: summary.targetSodiumMg,
      targetWaterMl: summary.targetWaterMl,
      supplies: getSuppliesForTarget(values, target),
      waterRefill: target === 'start' || values.aidStations[summary.sectionIndex]?.waterRefill === true,
    });

    startMinute = endMinute;
  }

  return sections;
}

function buildSectionDrinkEvents(
  section: ContinuousSection,
  waterBagLiters: number,
  productMap: Record<string, PlanProduct>,
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

  const baseSlotCount = Math.max(1, Math.ceil(section.durationMin / MAX_DRINK_INTERVAL_MIN));
  const slotCount = Math.max(baseSlotCount, Math.ceil(totalDrinkMl / TARGET_DRINK_SIP_ML));
  const slotMinutes = buildAbsoluteDrinkSlots(section.startMinute, section.endMinute).slice(0, slotCount);
  const adjustedSlotMinutes =
    slotMinutes.length === slotCount
      ? slotMinutes
      : Array.from({ length: slotCount }, (_, index) =>
          Math.min(
            Math.round(section.endMinute),
            Math.max(Math.round(section.startMinute) + 1, Math.round(section.startMinute + ((index + 1) / slotCount) * section.durationMin)),
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
      minute: Math.max(0, absoluteMinute - section.startMinute),
      absoluteMinute,
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
}: BuildTimelineArgs): ContinuousIntakeEvent[] {
  const sections = buildContinuousSections({ values, elevationProfile });
  const allEvents: ContinuousIntakeEvent[] = [];
  const carbsPerMinute = Math.max(0, values.targetIntakePerHour / 60);
  const sodiumPerMinute = Math.max(0, values.sodiumIntakePerHour / 60);
  let consumedCarbs = 0;
  let consumedSodium = 0;
  let fallbackIndex = 0;

  sections.forEach((section) => {
    const solidUnits = section.supplies.flatMap((supply) => {
      const product = productMap[supply.productId];
      if (!product || supply.quantity <= 0 || isFluidProduct(product)) return [];

      return Array.from({ length: supply.quantity }, () => ({
        label: product.name,
        carbs: Math.max(product.carbs_g ?? 0, 0),
        sodium: Math.max(product.sodium_mg ?? 0, 0),
      }));
    });

    solidUnits.forEach((unit) => {
      const candidates: Array<{ absoluteMinute: number; weight: number }> = [];

      if (unit.carbs > 0 && carbsPerMinute > 0) {
        candidates.push({
          absoluteMinute: (consumedCarbs + unit.carbs) / carbsPerMinute,
          weight: unit.carbs,
        });
      }

      if (unit.sodium > 0 && sodiumPerMinute > 0) {
        candidates.push({
          absoluteMinute: (consumedSodium + unit.sodium) / sodiumPerMinute,
          weight: unit.sodium / 100,
        });
      }

      let absoluteMinute: number;
      if (candidates.length > 0) {
        const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
        absoluteMinute =
          candidates.reduce((sum, candidate) => sum + candidate.absoluteMinute * candidate.weight, 0) /
          Math.max(totalWeight, 1);
      } else {
        fallbackIndex += 1;
        absoluteMinute =
          section.startMinute + ((fallbackIndex % Math.max(solidUnits.length + 1, 2)) / Math.max(solidUnits.length + 1, 2)) * section.durationMin;
      }

      absoluteMinute = Math.min(section.endMinute, Math.max(section.startMinute + 1, Math.round(absoluteMinute)));

      consumedCarbs += unit.carbs;
      consumedSodium += unit.sodium;

      const detailParts: string[] = [];
      if (unit.carbs > 0) detailParts.push(`${Math.round(unit.carbs)}g glucides`);
      if (unit.sodium > 0) detailParts.push(`${Math.round(unit.sodium)}mg sodium`);

      allEvents.push({
        id: `section-${section.sectionIndex}-solid-${allEvents.length}`,
        minute: Math.max(0, absoluteMinute - section.startMinute),
        absoluteMinute,
        sectionIndex: section.sectionIndex,
        sectionTarget: section.target,
        fromName: section.fromName,
        toName: section.toName,
        startKm: section.startKm,
        endKm: section.endKm,
        label: unit.label,
        detail: detailParts.length > 0 ? detailParts.join(' - ') : '1 prise',
        carbsGrams: Math.round(unit.carbs),
        sodiumMg: Math.round(unit.sodium),
        waterMl: 0,
        products: [
          {
            name: unit.label,
            quantity: 1,
            carbsGrams: Math.round(unit.carbs),
            sodiumMg: Math.round(unit.sodium),
            waterMl: 0,
          },
        ],
      });
    });

    allEvents.push(...buildSectionDrinkEvents(section, values.waterBagLiters, productMap));
  });

  return allEvents.sort((a, b) => {
    if (a.absoluteMinute !== b.absoluteMinute) return a.absoluteMinute - b.absoluteMinute;
    if ((a.label === 'Eau' ? 1 : 0) !== (b.label === 'Eau' ? 1 : 0)) {
      return (a.label === 'Eau' ? 1 : 0) - (b.label === 'Eau' ? 1 : 0);
    }
    return a.label.localeCompare(b.label);
  });
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
      minute: Math.max(0, event.absoluteMinute - section.startMinute),
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
