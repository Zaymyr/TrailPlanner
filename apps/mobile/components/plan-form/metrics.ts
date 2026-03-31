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
import { DEPART_ID, ARRIVEE_ID } from './contracts';
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
  const totalCarbs = supplies.reduce((sum, supply) => {
    const product = productMap[supply.productId];
    return sum + (product ? (product.carbs_g ?? 0) * supply.quantity : 0);
  }, 0);
  const totalSodium = supplies.reduce((sum, supply) => {
    const product = productMap[supply.productId];
    return sum + (product ? (product.sodium_mg ?? 0) * supply.quantity : 0);
  }, 0);
  const availableWaterMl =
    target === 'start' || aidStations[target]?.waterRefill ? waterBagLiters * 1000 : 0;

  return [
    {
      key: 'carbs',
      label: 'Glucides',
      unit: 'g',
      color: '#2D5016',
      current: totalCarbs,
      target: sectionTarget?.targetCarbsG ?? 0,
      ratio: sectionTarget && sectionTarget.targetCarbsG > 0 ? totalCarbs / sectionTarget.targetCarbsG : 0,
    },
    {
      key: 'sodium',
      label: 'Sodium',
      unit: 'mg',
      color: '#3B82F6',
      current: totalSodium,
      target: sectionTarget?.targetSodiumMg ?? 0,
      ratio: sectionTarget && sectionTarget.targetSodiumMg > 0 ? totalSodium / sectionTarget.targetSodiumMg : 0,
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
  const availableWaterMl =
    target === 'start' || aidStations[target]?.waterRefill ? waterBagLiters * 1000 : 0;
  const totalTargetWater = Math.max(Math.min(sectionTarget?.targetWaterMl ?? 0, availableWaterMl), 0);

  const expandedUnits = supplies.flatMap((supply) => {
    const product = productMap[supply.productId];
    if (!product || supply.quantity <= 0) return [];

    return Array.from({ length: supply.quantity }, () => ({
      label: product.name,
      carbs: Math.max(product.carbs_g ?? 0, 0),
      sodium: Math.max(product.sodium_mg ?? 0, 0),
      fluid: product.fuel_type === 'drink_mix' || product.fuel_type === 'electrolyte',
    }));
  });

  const events: IntakeTimelineItem[] = [];

  if (safeDuration <= 0) {
    expandedUnits.forEach((unit) => {
      const detailParts: string[] = [];
      if (unit.carbs > 0) detailParts.push(`${Math.round(unit.carbs)}g glucides`);
      if (unit.sodium > 0) detailParts.push(`${Math.round(unit.sodium)}mg sodium`);
      events.push({
        minute: 0,
        label: unit.label,
        detail: detailParts.length > 0 ? detailParts.join(' - ') : '1 prise',
        immediate: true,
      });
    });
    return events;
  }

  let cumulativeCarbs = 0;
  let cumulativeSodium = 0;
  const fluidEventMinutes: number[] = [];

  expandedUnits.forEach((unit, index) => {
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
    });

    if (unit.fluid) fluidEventMinutes.push(minute);
  });

  if (totalTargetWater > 0) {
    const waterRatePerMinute = totalTargetWater / safeDuration;
    let remainingWaterMl = totalTargetWater;
    let lastWaterMinute = 0;
    const waterEvents: Array<{ minute: number; amountMl: number }> = [];

    for (
      let targetMinute = Math.min(10, safeDuration);
      targetMinute <= safeDuration && remainingWaterMl > 0;
      targetMinute += 10
    ) {
      let scheduledMinute = targetMinute;

      while (
        scheduledMinute < safeDuration &&
        fluidEventMinutes.some((fluidMinute) => Math.abs(fluidMinute - scheduledMinute) <= 1)
      ) {
        scheduledMinute = Math.min(safeDuration, scheduledMinute + 2);
      }

      const elapsedMinutes = Math.max(1, scheduledMinute - lastWaterMinute);
      const sipMl = Math.min(
        remainingWaterMl,
        Math.max(1, Math.round(waterRatePerMinute * elapsedMinutes)),
      );

      waterEvents.push({ minute: scheduledMinute, amountMl: sipMl });
      remainingWaterMl = Math.max(0, remainingWaterMl - sipMl);
      lastWaterMinute = scheduledMinute;
    }

    if (remainingWaterMl > 0) {
      if (waterEvents.length > 0) {
        waterEvents[waterEvents.length - 1].amountMl += Math.round(remainingWaterMl);
      } else {
        waterEvents.push({ minute: Math.min(10, safeDuration), amountMl: Math.round(remainingWaterMl) });
      }
    }

    waterEvents.forEach((waterEvent) => {
      events.push({
        minute: waterEvent.minute,
        label: 'Eau',
        detail: `${Math.round(waterEvent.amountMl)} ml`,
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
    totalDurationLabel: formatDurationLabel(totalDurationMin),
    totalProductUnits,
    distinctProductsCount,
    intermediateCount,
    plannedCarbsG,
    plannedSodiumMg,
    productBreakdown,
  };
}
