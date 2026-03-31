import type { GaugeMetric } from './GaugeArc';
import type {
  AidStationFormItem,
  IntakeTimelineItem,
  PlanFormValues,
  PlanHighlights,
  PlanProduct,
  PlanTarget,
  SectionSummary,
  SectionTarget,
  Supply,
} from './contracts';
import {
  ARRIVEE_ID,
  DEFAULT_FLUID_MIX_SHARE,
  DEFAULT_FLUID_PRODUCT_VOLUME_ML,
  DEPART_ID,
} from './contracts';
import { formatDurationLabel } from './helpers';

type SuppliesGetter = (target: PlanTarget) => Supply[];

type BuildGaugeMetricsArgs = {
  target: PlanTarget;
  sectionTarget?: SectionTarget;
  getSupplies: SuppliesGetter;
  productMap: Record<string, PlanProduct>;
  aidStations: AidStationFormItem[];
  waterBagLiters: number;
};

type BuildTimelineArgs = BuildGaugeMetricsArgs & {
  sectionDurationMin: number;
};

type BuildPlanHighlightsArgs = {
  values: PlanFormValues;
  productMap: Record<string, PlanProduct>;
  buildSectionSummary: (target: PlanTarget) => SectionSummary | null;
};

const MAX_DRINK_INTERVAL_MIN = 10;
const TARGET_DRINK_SIP_ML = 140;

function distributeIntegerTotal(total: number, count: number): number[] {
  const safeCount = Math.max(1, count);
  const safeTotal = Math.max(0, Math.round(total));
  const baseValue = Math.floor(safeTotal / safeCount);
  const remainder = safeTotal - baseValue * safeCount;
  return Array.from({ length: safeCount }, (_, index) => baseValue + (index < remainder ? 1 : 0));
}

function buildDrinkSlotMinutes(durationMin: number, slotCount: number): number[] {
  const safeDuration = Math.max(1, Math.round(durationMin));
  const safeSlotCount = Math.max(1, slotCount);
  return Array.from({ length: safeSlotCount }, (_, index) =>
    Math.min(safeDuration, Math.max(1, Math.round(((index + 1) / safeSlotCount) * safeDuration))),
  );
}

function isFluidProduct(product: PlanProduct | undefined) {
  return product?.fuel_type === 'drink_mix' || product?.fuel_type === 'electrolyte';
}

function getAvailableWaterMl(target: PlanTarget, aidStations: AidStationFormItem[], waterBagLiters: number) {
  return target === 'start' || aidStations[target]?.waterRefill ? waterBagLiters * 1000 : 0;
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

  const fluidCarbs = activeFluidEntry?.carbs ?? 0;
  const fluidSodium = activeFluidEntry?.sodium ?? 0;
  const requestedFluidWaterMl = activeFluidEntry?.requestedWaterMl ?? 0;

  const fluidWaterBudgetMl = availableWaterMl * DEFAULT_FLUID_MIX_SHARE;
  const effectiveFluidRatio =
    requestedFluidWaterMl > 0 ? Math.min(1, fluidWaterBudgetMl / requestedFluidWaterMl) : 0;
  const effectiveFluidWaterMl = requestedFluidWaterMl * effectiveFluidRatio;
  const effectiveFluidCarbs = fluidCarbs * effectiveFluidRatio;
  const effectiveFluidSodium = fluidSodium * effectiveFluidRatio;

  return {
    totalCarbs: solidCarbs + effectiveFluidCarbs,
    totalSodium: solidSodium + effectiveFluidSodium,
    requestedFluidWaterMl,
    effectiveFluidWaterMl,
    effectiveFluidCarbs,
    effectiveFluidSodium,
    fluidLabels: activeFluidEntry ? [activeFluidEntry.label] : [],
  };
}

export function getGaugeColor(key: GaugeMetric['key'], ratio: number): string {
  if (key === 'water') {
    return ratio >= 0.8 ? '#2D5016' : '#EF4444';
  }
  if (ratio === 0) return '#D1D5DB';
  if (ratio >= 0.8 && ratio <= 1.2) return '#2D5016';
  if ((ratio >= 0.6 && ratio < 0.8) || (ratio > 1.2 && ratio <= 1.4)) return '#F97316';
  return '#EF4444';
}

export function formatGaugeValue(metric: GaugeMetric, value: number): string {
  if (metric.key === 'water') {
    const liters = value / 1000;
    const formatted = Number.isInteger(liters) ? liters.toFixed(0) : liters.toFixed(1);
    return `${formatted}L`;
  }
  return `${Math.round(value)}${metric.unit}`;
}

export function buildGaugeMetrics({
  target,
  sectionTarget,
  getSupplies,
  productMap,
  aidStations,
  waterBagLiters,
}: BuildGaugeMetricsArgs): GaugeMetric[] {
  const supplies = getSupplies(target);
  const availableWaterMl = getAvailableWaterMl(target, aidStations, waterBagLiters);
  const summarized = summarizeSuppliesWithFluidConstraint(supplies, productMap, availableWaterMl);

  return [
    {
      key: 'carbs',
      label: 'Glucides',
      unit: 'g',
      color: '#2D5016',
      current: summarized.totalCarbs,
      target: sectionTarget?.targetCarbsG ?? 0,
      ratio: sectionTarget && sectionTarget.targetCarbsG > 0 ? summarized.totalCarbs / sectionTarget.targetCarbsG : 0,
    },
    {
      key: 'sodium',
      label: 'Sodium',
      unit: 'mg',
      color: '#3B82F6',
      current: summarized.totalSodium,
      target: sectionTarget?.targetSodiumMg ?? 0,
      ratio: sectionTarget && sectionTarget.targetSodiumMg > 0 ? summarized.totalSodium / sectionTarget.targetSodiumMg : 0,
    },
    {
      key: 'water',
      label: 'Eau',
      unit: 'ml',
      color: '#06B6D4',
      current: availableWaterMl,
      target: sectionTarget?.targetWaterMl ?? 0,
      ratio: sectionTarget && sectionTarget.targetWaterMl > 0 ? availableWaterMl / sectionTarget.targetWaterMl : 0,
    },
  ];
}

export function buildSectionIntakeTimelineV2({
  target,
  sectionDurationMin,
  sectionTarget,
  getSupplies,
  productMap,
  aidStations,
  waterBagLiters,
}: BuildTimelineArgs): IntakeTimelineItem[] {
  const supplies = getSupplies(target);
  const safeDuration = Math.max(0, Math.round(sectionDurationMin));
  const totalTargetCarbs = Math.max(sectionTarget?.targetCarbsG ?? 0, 0);
  const totalTargetSodium = Math.max(sectionTarget?.targetSodiumMg ?? 0, 0);
  const availableWaterMl = getAvailableWaterMl(target, aidStations, waterBagLiters);
  const totalTargetWater = Math.max(Math.min(sectionTarget?.targetWaterMl ?? 0, availableWaterMl), 0);
  const summarized = summarizeSuppliesWithFluidConstraint(supplies, productMap, availableWaterMl);

  const expandedUnits = supplies.flatMap((supply) => {
    const product = productMap[supply.productId];
    if (!product || supply.quantity <= 0) return [];

    return Array.from({ length: supply.quantity }, () => ({
      label: product.name,
      carbs: Math.max(product.carbs_g ?? 0, 0),
      sodium: Math.max(product.sodium_mg ?? 0, 0),
      fluid: product.fuel_type === 'drink_mix' || product.fuel_type === 'electrolyte',
      fluidVolumeMl:
        product.fuel_type === 'drink_mix' || product.fuel_type === 'electrolyte'
          ? DEFAULT_FLUID_PRODUCT_VOLUME_ML
          : 0,
    }));
  });

  const solidUnits = expandedUnits.filter((unit) => !unit.fluid);
  const fluidUnits = expandedUnits.filter((unit) => unit.fluid);

  const events: IntakeTimelineItem[] = [];

  if (safeDuration <= 0) {
    expandedUnits.forEach((unit) => {
      const detailParts: string[] = [];
      if (unit.fluidVolumeMl > 0) detailParts.push(`${Math.round(unit.fluidVolumeMl)} ml`);
      if (unit.carbs > 0) detailParts.push(`${Math.round(unit.carbs)}g glucides`);
      if (unit.sodium > 0) detailParts.push(`${Math.round(unit.sodium)}mg sodium`);
      events.push({
        minute: 0,
        label: unit.label,
        detail: detailParts.length > 0 ? detailParts.join(' - ') : '1 prise',
        carbsGrams: Math.round(unit.carbs),
        sodiumMg: Math.round(unit.sodium),
        waterMl: Math.round(unit.fluidVolumeMl),
        products: [
          {
            name: unit.label,
            quantity: 1,
            carbsGrams: Math.round(unit.carbs),
            sodiumMg: Math.round(unit.sodium),
            waterMl: Math.round(unit.fluidVolumeMl),
          },
        ],
        immediate: true,
      });
    });
    return events;
  }

  let cumulativeCarbs = 0;
  let cumulativeSodium = 0;

  solidUnits.forEach((unit, index) => {
    const candidates: Array<{ minute: number; weight: number }> = [];

    if (totalTargetCarbs > 0 && unit.carbs > 0) {
      const nextCarbs = cumulativeCarbs + unit.carbs;
      candidates.push({
        minute: (nextCarbs / totalTargetCarbs) * safeDuration,
        weight: unit.carbs / totalTargetCarbs,
      });
    }

    if (totalTargetSodium > 0 && unit.sodium > 0) {
      const nextSodium = cumulativeSodium + unit.sodium;
      candidates.push({
        minute: (nextSodium / totalTargetSodium) * safeDuration,
        weight: unit.sodium / totalTargetSodium,
      });
    }

    let minute = 0;
    if (candidates.length > 0) {
      const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
      minute = Math.round(
        candidates.reduce((sum, candidate) => sum + candidate.minute * candidate.weight, 0) / Math.max(totalWeight, 1),
      );
    } else {
      minute = Math.round(((index + 1) / (expandedUnits.length + 1)) * safeDuration);
    }

    minute = Math.min(safeDuration, Math.max(1, minute));
    cumulativeCarbs += unit.carbs;
    cumulativeSodium += unit.sodium;

    const detailParts: string[] = [];
    if (unit.carbs > 0) detailParts.push(`${Math.round(unit.carbs)}g glucides`);
    if (unit.sodium > 0) detailParts.push(`${Math.round(unit.sodium)}mg sodium`);
    events.push({
      minute,
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

  const totalFluidProductWaterMl = summarized.effectiveFluidWaterMl;
  const totalFluidCarbs = summarized.effectiveFluidCarbs;
  const totalFluidSodium = summarized.effectiveFluidSodium;
  const totalDrinkMl = fluidUnits.length > 0 ? Math.max(totalTargetWater, totalFluidProductWaterMl) : totalTargetWater;

  if (totalDrinkMl > 0) {
    const baseSlotCount = Math.max(1, Math.ceil(safeDuration / MAX_DRINK_INTERVAL_MIN));
    const slotCount = Math.max(baseSlotCount, Math.ceil(totalDrinkMl / TARGET_DRINK_SIP_ML));
    const slotMinutes = buildDrinkSlotMinutes(safeDuration, slotCount);
    const fluidWaterPerSlot = distributeIntegerTotal(totalFluidProductWaterMl, slotCount);
    const plainWaterPerSlot = distributeIntegerTotal(Math.max(totalDrinkMl - totalFluidProductWaterMl, 0), slotCount);
    const carbsPerSlot = distributeIntegerTotal(totalFluidCarbs, slotCount);
    const sodiumPerSlot = distributeIntegerTotal(totalFluidSodium, slotCount);
    const uniqueFluidLabels = summarized.fluidLabels;
    const fluidLabel = uniqueFluidLabels.length === 1 ? uniqueFluidLabels[0] : 'Boisson';

    slotMinutes.forEach((minute, index) => {
      const slotWaterMl = fluidWaterPerSlot[index] + plainWaterPerSlot[index];
      const slotCarbs = carbsPerSlot[index];
      const slotSodium = sodiumPerSlot[index];
      if (slotWaterMl <= 0 && slotCarbs <= 0 && slotSodium <= 0) return;

      const detailParts: string[] = [];
      if (slotWaterMl > 0) detailParts.push(`${slotWaterMl} ml`);
      if (slotCarbs > 0) detailParts.push(`${slotCarbs}g glucides`);
      if (slotSodium > 0) detailParts.push(`${slotSodium}mg sodium`);

      events.push({
        minute,
        label: fluidUnits.length > 0 ? fluidLabel : 'Eau',
        detail: detailParts.join(' - '),
        carbsGrams: slotCarbs,
        sodiumMg: slotSodium,
        waterMl: slotWaterMl,
        products:
          fluidUnits.length > 0
            ? [
                {
                  name: fluidLabel,
                  quantity: 1,
                  carbsGrams: slotCarbs,
                  sodiumMg: slotSodium,
                  waterMl: slotWaterMl,
                },
              ]
            : undefined,
      });
    });
  }

  events.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    if ((a.label === 'Eau' ? 1 : 0) !== (b.label === 'Eau' ? 1 : 0)) {
      return (a.label === 'Eau' ? 1 : 0) - (b.label === 'Eau' ? 1 : 0);
    }
    return a.label.localeCompare(b.label);
  });

  return events;
}

export function buildPlanHighlights({
  values,
  productMap,
  buildSectionSummary,
}: BuildPlanHighlightsArgs): PlanHighlights {
  const intermediateCount = values.aidStations.filter((station) => station.id !== DEPART_ID && station.id !== ARRIVEE_ID).length;
  const sectionTargets = values.aidStations.slice(0, -1).reduce<PlanTarget[]>((targets, _, index) => {
    targets.push(index === 0 ? 'start' : index);
    return targets;
  }, []);
  const totalDurationMin = sectionTargets.reduce<number>(
    (sum, target) => sum + (buildSectionSummary(target)?.durationMin ?? 0),
    0,
  );
  const allSupplies = [
    ...(values.startSupplies ?? []),
    ...values.aidStations.flatMap((station) => station.supplies ?? []),
  ];
  const suppliesByProductId = allSupplies.reduce<Record<string, number>>((acc, supply) => {
    acc[supply.productId] = (acc[supply.productId] ?? 0) + supply.quantity;
    return acc;
  }, {});
  const totalProductUnits = Object.values(suppliesByProductId).reduce((sum, quantity) => sum + quantity, 0);
  const distinctProductsCount = Object.keys(suppliesByProductId).length;
  const plannedCarbsG = Math.round(
    Object.entries(suppliesByProductId).reduce(
      (sum, [productId, quantity]) => sum + (productMap[productId]?.carbs_g ?? 0) * quantity,
      0,
    ),
  );
  const plannedSodiumMg = Math.round(
    Object.entries(suppliesByProductId).reduce(
      (sum, [productId, quantity]) => sum + (productMap[productId]?.sodium_mg ?? 0) * quantity,
      0,
    ),
  );

  const productBreakdown = Object.entries(suppliesByProductId)
    .sort(([, quantityA], [, quantityB]) => quantityB - quantityA)
    .slice(0, 6)
    .map(([productId, quantity]) => ({
      label: productMap[productId]?.name ?? 'Produit',
      quantity,
    }));

  if (distinctProductsCount > productBreakdown.length) {
    productBreakdown.push({
      label: `+${distinctProductsCount - productBreakdown.length} autres`,
      quantity: 0,
    });
  }

  return {
    totalDurationMin,
    totalDurationLabel: formatDurationLabel(totalDurationMin),
    totalProductUnits,
    distinctProductsCount,
    intermediateCount,
    plannedCarbsG,
    plannedSodiumMg,
    productBreakdown,
  };
}
