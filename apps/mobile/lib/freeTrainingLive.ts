import {
  DEFAULT_FLUID_PRODUCT_VOLUME_ML,
  type PlanProduct,
  type Supply,
} from '../components/plan-form/contracts';
import type { LiveAlertSpec, WaterOnlyReminderIntervalMinutes } from './raceLivePlan';

export type FreeTrainingTargets = {
  carbsPerHour: number;
  waterMlPerHour: number;
  sodiumMgPerHour: number;
};

export type FreeTrainingResourceKey = 'carbs' | 'water' | 'sodium';

export type FreeTrainingResourceAutonomy = {
  key: FreeTrainingResourceKey;
  label: string;
  unit: string;
  total: number;
  targetPerHour: number;
  minutes: number | null;
  status: 'ignored' | 'empty' | 'available';
};

export type FreeTrainingSummary = {
  resources: FreeTrainingResourceAutonomy[];
  firstShortageMinutes: number | null;
  trackingEndMinutes: number | null;
  limitingKeys: FreeTrainingResourceKey[];
  waterCapacityMl: number;
  fluidVolumeMl: number;
  plainWaterMl: number;
  fluidOverCapacityMl: number;
  totalCarbsG: number;
  totalSodiumMg: number;
  canStart: boolean;
};

type TrainingUnit = {
  unitId: string;
  productId: string;
  label: string;
  carbsGrams: number;
  sodiumMg: number;
  waterMl: number;
};

type BuildSummaryArgs = {
  targets: FreeTrainingTargets;
  waterCapacityMl: number;
  supplies: Supply[];
  productMap: Record<string, PlanProduct>;
};

type BuildAlertsArgs = BuildSummaryArgs & {
  waterOnlyReminderIntervalMinutes: WaterOnlyReminderIntervalMinutes;
};

const DEFAULT_INITIAL_BUFFER_MINUTES = 60;

function isFluidProduct(product: PlanProduct | undefined) {
  return product?.fuel_type === 'drink_mix' || product?.fuel_type === 'electrolyte';
}

function roundToStep(minute: number, step = 5) {
  return Math.max(0, Math.round(minute / step) * step);
}

function formatDetailParts(parts: Array<string | null>) {
  return parts.filter((part): part is string => part !== null).join(' - ');
}

function buildResource(
  key: FreeTrainingResourceKey,
  label: string,
  unit: string,
  total: number,
  targetPerHour: number,
  baseMinutes = 0,
): FreeTrainingResourceAutonomy {
  if (targetPerHour <= 0) {
    return {
      key,
      label,
      unit,
      total,
      targetPerHour,
      minutes: null,
      status: 'ignored',
    };
  }

  const minutes = Math.max(0, baseMinutes) + (total > 0 ? (total / targetPerHour) * 60 : 0);
  return {
    key,
    label,
    unit,
    total,
    targetPerHour,
    minutes,
    status: minutes > 0 ? 'available' : 'empty',
  };
}

export function summarizeFreeTraining(args: BuildSummaryArgs): FreeTrainingSummary {
  const { productMap, supplies, targets } = args;
  const waterCapacityMl = Math.max(0, Math.round(args.waterCapacityMl));
  let fluidVolumeMl = 0;
  let totalCarbsG = 0;
  let totalSodiumMg = 0;

  supplies.forEach((supply) => {
    const product = productMap[supply.productId];
    const quantity = Math.max(0, Math.floor(supply.quantity));
    if (!product || quantity <= 0) return;

    totalCarbsG += Math.max(product.carbs_g ?? 0, 0) * quantity;
    totalSodiumMg += Math.max(product.sodium_mg ?? 0, 0) * quantity;
    if (isFluidProduct(product)) {
      fluidVolumeMl += DEFAULT_FLUID_PRODUCT_VOLUME_ML * quantity;
    }
  });

  const fluidOverCapacityMl = Math.max(0, fluidVolumeMl - waterCapacityMl);
  const resources = [
    buildResource('water', 'Eau', 'ml', waterCapacityMl, targets.waterMlPerHour, DEFAULT_INITIAL_BUFFER_MINUTES),
    buildResource('carbs', 'Glucides', 'g', totalCarbsG, targets.carbsPerHour, DEFAULT_INITIAL_BUFFER_MINUTES),
    buildResource('sodium', 'Sodium', 'mg', totalSodiumMg, targets.sodiumMgPerHour, DEFAULT_INITIAL_BUFFER_MINUTES),
  ];
  const activeMinutes = resources
    .filter((resource) => resource.status !== 'ignored')
    .map((resource) => resource.minutes ?? 0);
  const positiveMinutes = activeMinutes.filter((minutes) => minutes > 0);
  const firstShortageMinutes = activeMinutes.length > 0 ? Math.min(...activeMinutes) : null;
  const trackingEndMinutes = positiveMinutes.length > 0 ? Math.max(...positiveMinutes) : null;
  const limitingKeys =
    firstShortageMinutes === null
      ? []
      : resources
          .filter((resource) => resource.status !== 'ignored')
          .filter((resource) => Math.round(resource.minutes ?? 0) === Math.round(firstShortageMinutes))
          .map((resource) => resource.key);

  return {
    resources,
    firstShortageMinutes,
    trackingEndMinutes,
    limitingKeys,
    waterCapacityMl,
    fluidVolumeMl,
    plainWaterMl: Math.max(0, waterCapacityMl - fluidVolumeMl),
    fluidOverCapacityMl,
    totalCarbsG,
    totalSodiumMg,
    canStart: fluidOverCapacityMl <= 0 && trackingEndMinutes !== null && trackingEndMinutes > 0,
  };
}

function expandUnits(
  supplies: Supply[],
  productMap: Record<string, PlanProduct>,
  predicate: (product: PlanProduct) => boolean,
) {
  return supplies.flatMap<TrainingUnit>((supply) => {
    const product = productMap[supply.productId];
    const quantity = Math.max(0, Math.floor(supply.quantity));
    if (!product || quantity <= 0 || !predicate(product)) return [];

    return Array.from({ length: quantity }, (_, index) => ({
      unitId: `${supply.productId}-${index}`,
      productId: supply.productId,
      label: product.name,
      carbsGrams: Math.max(product.carbs_g ?? 0, 0),
      sodiumMg: Math.max(product.sodium_mg ?? 0, 0),
      waterMl: isFluidProduct(product) ? DEFAULT_FLUID_PRODUCT_VOLUME_ML : 0,
    }));
  });
}

function buildProductEvents(
  units: TrainingUnit[],
  autonomyMinutes: number | null,
  idPrefix: string,
  startMinute = 0,
): LiveAlertSpec[] {
  if (!autonomyMinutes || autonomyMinutes <= 0 || units.length === 0) return [];

  const safeStartMinute = Math.max(0, Math.min(startMinute, autonomyMinutes));
  const duration = Math.max(5, autonomyMinutes - safeStartMinute);
  return units.map<LiveAlertSpec>((unit, index) => {
    const rawMinute = safeStartMinute + ((index + 0.5) / units.length) * duration;
    const triggerMinutes = Math.max(5, Math.min(Math.round(autonomyMinutes), roundToStep(rawMinute)));
    const detail = formatDetailParts([
      unit.carbsGrams > 0 ? `${Math.round(unit.carbsGrams)}g glucides` : null,
      unit.sodiumMg > 0 ? `${Math.round(unit.sodiumMg)}mg sodium` : null,
    ]);

    return {
      id: `${idPrefix}-${unit.unitId}`,
      triggerMinutes,
      title: `Prendre ${unit.label}`,
      body: `${detail || '1 prise'} | Entrainement libre`,
      payload: {
        sectionIndex: 0,
        fromName: 'Entrainement',
        toName: 'Fin du suivi',
        carbsGrams: Math.round(unit.carbsGrams),
        sodiumMg: Math.round(unit.sodiumMg),
        waterMl: 0,
        detail: detail || '1 prise',
        products: [
          {
            name: unit.label,
            quantity: 1,
            carbsGrams: Math.round(unit.carbsGrams),
            sodiumMg: Math.round(unit.sodiumMg),
            waterMl: 0,
          },
        ],
      },
    };
  });
}

function buildWaterEvents(args: BuildAlertsArgs, summary: FreeTrainingSummary): LiveAlertSpec[] {
  if (args.targets.waterMlPerHour <= 0 || summary.waterCapacityMl <= 0) return [];

  const waterAutonomy = summary.resources.find((resource) => resource.key === 'water')?.minutes ?? 0;
  if (waterAutonomy <= 0) return [];

  const fluidUnits = expandUnits(args.supplies, args.productMap, isFluidProduct);
  const fluidCarbsG = fluidUnits.reduce((sum, unit) => sum + unit.carbsGrams, 0);
  const fluidSodiumMg = fluidUnits.reduce((sum, unit) => sum + unit.sodiumMg, 0);
  const fluidLabels = [...new Set(fluidUnits.map((unit) => unit.label))];
  const intervalMinutes = args.waterOnlyReminderIntervalMinutes;
  const targetWaterPerSlot = Math.max(1, (args.targets.waterMlPerHour / 60) * intervalMinutes);
  const events: LiveAlertSpec[] = [];
  let remainingWaterMl = summary.waterCapacityMl;
  let remainingFluidMl = Math.min(summary.fluidVolumeMl, summary.waterCapacityMl);
  let index = 0;

  while (remainingWaterMl > 0 && index < 500) {
    index += 1;
    const triggerMinutes = Math.min(waterAutonomy, index * intervalMinutes);
    const waterMl = Math.min(remainingWaterMl, targetWaterPerSlot);
    const fluidMl = Math.min(remainingFluidMl, waterMl);
    const fluidRatio = summary.fluidVolumeMl > 0 ? fluidMl / summary.fluidVolumeMl : 0;
    const carbsGrams = Math.round(fluidCarbsG * fluidRatio);
    const sodiumMg = Math.round(fluidSodiumMg * fluidRatio);
    const roundedWaterMl = Math.round(waterMl);
    const hasFluid = fluidMl > 0;
    const label =
      hasFluid && fluidLabels.length === 1
        ? fluidLabels[0]
        : hasFluid
          ? 'Boisson'
          : 'Eau';
    const detail = formatDetailParts([
      `${roundedWaterMl} ml`,
      carbsGrams > 0 ? `${carbsGrams}g glucides` : null,
      sodiumMg > 0 ? `${sodiumMg}mg sodium` : null,
    ]);

    events.push({
      id: `free-training-water-${index}`,
      triggerMinutes: Math.max(1, roundToStep(triggerMinutes)),
      title: hasFluid ? `Boire ${label}` : 'Boire',
      body: `${detail} | Entrainement libre`,
      payload: {
        sectionIndex: 0,
        fromName: 'Entrainement',
        toName: 'Fin du suivi',
        carbsGrams,
        sodiumMg,
        waterMl: roundedWaterMl,
        detail,
        products: hasFluid
          ? [
              {
                name: label,
                quantity: fluidMl / DEFAULT_FLUID_PRODUCT_VOLUME_ML,
                carbsGrams,
                sodiumMg,
                waterMl: roundedWaterMl,
              },
            ]
          : [],
      },
    });

    remainingWaterMl -= waterMl;
    remainingFluidMl -= fluidMl;
  }

  return events;
}

function buildInitialBufferAlerts(summary: FreeTrainingSummary): LiveAlertSpec[] {
  const alerts: LiveAlertSpec[] = [];
  const waterResource = summary.resources.find((resource) => resource.key === 'water');
  const carbResource = summary.resources.find((resource) => resource.key === 'carbs');
  const sodiumResource = summary.resources.find((resource) => resource.key === 'sodium');

  if (waterResource && waterResource.targetPerHour > 0 && summary.waterCapacityMl <= 0 && (waterResource.minutes ?? 0) >= DEFAULT_INITIAL_BUFFER_MINUTES) {
    alerts.push({
      id: 'free-training-water-buffer',
      triggerMinutes: DEFAULT_INITIAL_BUFFER_MINUTES,
      title: 'Boire',
      body: "Besoin d'eau | Entrainement libre",
      payload: {
        sectionIndex: 0,
        fromName: 'Entrainement',
        toName: 'Fin du suivi',
        carbsGrams: 0,
        sodiumMg: 0,
        waterMl: 0,
        detail: "Besoin d'eau",
        products: [],
      },
    });
  }

  if (carbResource && carbResource.targetPerHour > 0 && summary.totalCarbsG <= 0 && (carbResource.minutes ?? 0) >= DEFAULT_INITIAL_BUFFER_MINUTES) {
    alerts.push({
      id: 'free-training-carb-buffer',
      triggerMinutes: DEFAULT_INITIAL_BUFFER_MINUTES,
      title: 'Manger',
      body: 'Besoin de glucides | Entrainement libre',
      payload: {
        sectionIndex: 0,
        fromName: 'Entrainement',
        toName: 'Fin du suivi',
        carbsGrams: 0,
        sodiumMg: 0,
        waterMl: 0,
        detail: 'Besoin de glucides',
        products: [],
      },
    });
  }

  if (sodiumResource && sodiumResource.targetPerHour > 0 && summary.totalSodiumMg <= 0 && (sodiumResource.minutes ?? 0) >= DEFAULT_INITIAL_BUFFER_MINUTES) {
    alerts.push({
      id: 'free-training-sodium-buffer',
      triggerMinutes: DEFAULT_INITIAL_BUFFER_MINUTES,
      title: 'Prendre du sodium',
      body: 'Besoin de sodium | Entrainement libre',
      payload: {
        sectionIndex: 0,
        fromName: 'Entrainement',
        toName: 'Fin du suivi',
        carbsGrams: 0,
        sodiumMg: 0,
        waterMl: 0,
        detail: 'Besoin de sodium',
        products: [],
      },
    });
  }

  return alerts;
}

function mergeCloseEvents(events: LiveAlertSpec[]): LiveAlertSpec[] {
  const sorted = [...events].sort((left, right) => {
    if (left.triggerMinutes !== right.triggerMinutes) return left.triggerMinutes - right.triggerMinutes;
    return left.id.localeCompare(right.id);
  });
  const merged: LiveAlertSpec[] = [];

  sorted.forEach((event) => {
    const previous = merged[merged.length - 1];
    if (!previous || event.triggerMinutes - previous.triggerMinutes > 4) {
      merged.push(event);
      return;
    }

    const carbsGrams = previous.payload.carbsGrams + event.payload.carbsGrams;
    const sodiumMg = previous.payload.sodiumMg + event.payload.sodiumMg;
    const waterMl = previous.payload.waterMl + event.payload.waterMl;
    const nutrientDetail = formatDetailParts([
      waterMl > 0 ? `${Math.round(waterMl)} ml` : null,
      carbsGrams > 0 ? `${Math.round(carbsGrams)}g glucides` : null,
      sodiumMg > 0 ? `${Math.round(sodiumMg)}mg sodium` : null,
    ]);
    const fallbackDetails = [...new Set([previous.payload.detail, event.payload.detail].filter(Boolean))].filter(
      (part) => !nutrientDetail.includes(part),
    );
    const detail = formatDetailParts([nutrientDetail || null, ...fallbackDetails]);
    const hasWater = waterMl > 0;
    const productNames = [...previous.payload.products, ...event.payload.products]
      .map((product) => product.name)
      .filter(Boolean);
    const uniqueProductNames = [...new Set(productNames)];
    const fallbackTitles = [...new Set([previous.title, event.title].filter(Boolean))];
    const fallbackTitle = fallbackTitles.join(' + ');

    merged[merged.length - 1] = {
      ...previous,
      title:
        uniqueProductNames.length > 0
          ? hasWater
            ? `Prendre ${uniqueProductNames.join(' + ')} + boire`
            : `Prendre ${uniqueProductNames.join(' + ')}`
          : hasWater
            ? [...new Set(['Boire', ...fallbackTitles.filter((title) => title !== 'Boire')])].join(' + ')
            : fallbackTitle || 'Manger',
      body: `${detail} | Entrainement libre`,
      payload: {
        ...previous.payload,
        carbsGrams,
        sodiumMg,
        waterMl,
        detail,
        products: [...previous.payload.products, ...event.payload.products],
      },
    };
  });

  return merged;
}

export function buildFreeTrainingAlertSpecs(args: BuildAlertsArgs): LiveAlertSpec[] {
  const summary = summarizeFreeTraining(args);
  if (!summary.canStart) return [];

  const resourcesByKey = new Map(summary.resources.map((resource) => [resource.key, resource]));
  const nonFluidUnits = expandUnits(args.supplies, args.productMap, (product) => !isFluidProduct(product));
  const carbUnits = nonFluidUnits.filter((unit) => unit.carbsGrams > 0);
  const scheduledUnitIds = new Set(carbUnits.map((unit) => unit.unitId));
  const sodiumUnits = nonFluidUnits.filter(
    (unit) => unit.sodiumMg > 0 && (args.targets.carbsPerHour <= 0 || !scheduledUnitIds.has(unit.unitId)),
  );
  const waterEvents = buildWaterEvents(args, summary);
  const initialBufferEvents = buildInitialBufferAlerts(summary);
  const carbEvents =
    args.targets.carbsPerHour > 0
      ? buildProductEvents(carbUnits, resourcesByKey.get('carbs')?.minutes ?? null, 'free-training-carb')
      : [];
  const sodiumEvents =
    args.targets.sodiumMgPerHour > 0
      ? buildProductEvents(sodiumUnits, resourcesByKey.get('sodium')?.minutes ?? null, 'free-training-sodium')
      : [];

  return mergeCloseEvents([...waterEvents, ...initialBufferEvents, ...carbEvents, ...sodiumEvents]);
}
