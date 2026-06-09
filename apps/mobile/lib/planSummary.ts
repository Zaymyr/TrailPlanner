import type { Locale } from '../locales/types';
import type {
  AidStationFormItem,
  PlanFormValues,
  PlanProduct,
  Supply,
} from '../components/plan-form/contracts';
import { ARRIVEE_ID, DEPART_ID } from '../components/plan-form/contracts';
import type { ElevationPoint } from '../components/plan-form/profile-utils';
import {
  buildLiveRaceSections,
  normalizeStoredPlanValues,
  type StoredRacePlan,
} from './raceLivePlan';

export type PlanSummaryProduct = {
  productId: string;
  name: string;
  brand: string | null;
  quantity: number;
  carbsG: number;
  sodiumMg: number;
};

export type PlanSummaryCheckpoint = {
  index: number;
  name: string;
  distanceKm: number;
  isStart: boolean;
  isFinish: boolean;
  arrivalMinute: number;
  pauseMinutes: number;
  supplies: PlanSummaryProduct[];
  waterState: 'full' | 'refill' | 'unavailable' | 'finish';
  solidState: 'available' | 'unavailable' | 'finish';
};

export type PlanSummary = {
  id: string;
  name: string;
  distanceKm: number;
  elevationGainM: number;
  waterBagLiters: number;
  targetCarbsPerHour: number;
  targetWaterPerHour: number;
  targetSodiumPerHour: number;
  totalDurationMin: number;
  totalProductUnits: number;
  totalCarbsG: number;
  totalSodiumMg: number;
  productTotals: PlanSummaryProduct[];
  checkpoints: PlanSummaryCheckpoint[];
};

export type PlanSummaryRow = {
  id: string;
  name: string;
  updated_at: string;
  planner_values?: Record<string, unknown> | null;
  elevation_profile?: unknown;
};

const SHARE_COPY = {
  fr: {
    distance: 'Distance',
    duration: 'Duree estimee',
    elevation: 'D+',
    give: 'A donner',
    header: 'Pace Yourself - Plan',
    pack: 'A preparer',
    start: 'Depart estime',
    team: 'Equipe ravitos',
    water: 'Eau',
    waterFinish: 'Arrivee',
    waterFull: 'partir avec {liters} L',
    waterRefill: 'remplir la poche',
    waterUnavailable: 'pas de recharge eau',
    noProducts: 'Aucun produit planifie',
    nothingToGive: 'Rien a donner',
    pause: 'Pause',
  },
  en: {
    distance: 'Distance',
    duration: 'Estimated duration',
    elevation: 'Gain',
    give: 'Give',
    header: 'Pace Yourself - Plan',
    pack: 'Pack list',
    start: 'Estimated start',
    team: 'Crew aid stations',
    water: 'Water',
    waterFinish: 'Finish',
    waterFull: 'start with {liters} L',
    waterRefill: 'refill the bladder',
    waterUnavailable: 'no water refill',
    noProducts: 'No planned products',
    nothingToGive: 'Nothing to give',
    pause: 'Pause',
  },
} as const;

function safeNumber(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

function toWholeQuantity(quantity: number | null | undefined) {
  if (!Number.isFinite(quantity) || (quantity ?? 0) <= 0) return 0;
  return Math.floor(quantity ?? 0);
}

function getPlannerValuesFromForm(values: PlanFormValues) {
  return {
    raceDistanceKm: values.raceDistanceKm,
    elevationGain: values.elevationGain,
    fatigueLevel: values.fatigueLevel,
    paceType: values.paceType,
    paceMinutes: values.paceMinutes,
    paceSeconds: values.paceSeconds,
    speedKph: values.speedKph,
    targetIntakePerHour: values.targetIntakePerHour,
    waterIntakePerHour: values.waterIntakePerHour,
    sodiumIntakePerHour: values.sodiumIntakePerHour,
    waterBagLiters: values.waterBagLiters,
    startSupplies: values.startSupplies,
    segments: values.sectionSegments,
    sectionSegments: values.sectionSegments,
    aidStations: values.aidStations,
  };
}

export function buildStoredRacePlanFromRow(data: PlanSummaryRow): StoredRacePlan {
  const plannerValues = (data.planner_values ?? {}) as StoredRacePlan['plannerValues'];

  return {
    id: data.id,
    name: data.name,
    updatedAt: data.updated_at,
    raceDistanceKm: Number(plannerValues?.raceDistanceKm ?? 0),
    elevationGainM: Number(plannerValues?.elevationGain ?? 0),
    targetCarbsPerHour: Number(plannerValues?.targetIntakePerHour ?? 0),
    targetWaterPerHour: Number(plannerValues?.waterIntakePerHour ?? 0),
    targetSodiumPerHour: Number(plannerValues?.sodiumIntakePerHour ?? 0),
    plannerValues,
    elevationProfile: Array.isArray(data.elevation_profile)
      ? (data.elevation_profile as ElevationPoint[])
      : [],
  };
}

export function buildStoredRacePlanFromValues(args: {
  id: string;
  updatedAt?: string;
  values: PlanFormValues;
  elevationProfile?: ElevationPoint[];
}): StoredRacePlan {
  const plannerValues = getPlannerValuesFromForm(args.values);

  return {
    id: args.id,
    name: args.values.name,
    updatedAt: args.updatedAt ?? new Date().toISOString(),
    raceDistanceKm: args.values.raceDistanceKm,
    elevationGainM: args.values.elevationGain,
    targetCarbsPerHour: args.values.targetIntakePerHour,
    targetWaterPerHour: args.values.waterIntakePerHour,
    targetSodiumPerHour: args.values.sodiumIntakePerHour,
    plannerValues,
    elevationProfile: args.elevationProfile ?? [],
  };
}

export function buildProductMap(products: PlanProduct[]) {
  return products.reduce<Record<string, PlanProduct>>((map, product) => {
    map[product.id] = product;
    return map;
  }, {});
}

function addProductIdsFromSupplies(ids: Set<string>, supplies: Supply[] | undefined) {
  supplies?.forEach((supply) => {
    if (supply.productId && toWholeQuantity(supply.quantity) > 0) {
      ids.add(supply.productId);
    }
  });
}

export function collectPlanProductIdsFromValues(values: PlanFormValues) {
  const ids = new Set<string>();
  addProductIdsFromSupplies(ids, values.startSupplies);
  values.aidStations.forEach((station) => {
    if (station.solidRefill === false) return;
    addProductIdsFromSupplies(ids, station.supplies);
  });
  return [...ids];
}

export function collectPlanProductIds(plan: StoredRacePlan) {
  return collectPlanProductIdsFromValues(normalizeStoredPlanValues(plan));
}

function groupSupplies(
  supplies: Supply[] | undefined,
  productMap: Record<string, PlanProduct>,
): PlanSummaryProduct[] {
  const grouped = new Map<string, number>();

  supplies?.forEach((supply) => {
    const quantity = toWholeQuantity(supply.quantity);
    if (!supply.productId || quantity <= 0) return;
    grouped.set(supply.productId, (grouped.get(supply.productId) ?? 0) + quantity);
  });

  return Array.from(grouped.entries())
    .map(([productId, quantity]) => {
      const product = productMap[productId];
      const carbsG = safeNumber(product?.carbs_g) * quantity;
      const sodiumMg = safeNumber(product?.sodium_mg) * quantity;

      return {
        productId,
        name: product?.name ?? 'Produit',
        brand: product?.brand ?? null,
        quantity,
        carbsG,
        sodiumMg,
      };
    })
    .sort((left, right) => right.quantity - left.quantity || left.name.localeCompare(right.name));
}

function mergeProductTotals(items: PlanSummaryProduct[]) {
  const totals = new Map<string, PlanSummaryProduct>();

  items.forEach((item) => {
    const current = totals.get(item.productId);
    if (!current) {
      totals.set(item.productId, { ...item });
      return;
    }

    current.quantity += item.quantity;
    current.carbsG += item.carbsG;
    current.sodiumMg += item.sodiumMg;
  });

  return Array.from(totals.values()).sort(
    (left, right) => right.quantity - left.quantity || left.name.localeCompare(right.name),
  );
}

function getStationSupplies(values: PlanFormValues, station: AidStationFormItem, index: number) {
  if (index === 0) return values.startSupplies;
  if (station.id === ARRIVEE_ID || station.solidRefill === false) return [];
  return station.supplies ?? [];
}

function getWaterState(station: AidStationFormItem, index: number) {
  if (index === 0) return 'full' as const;
  if (station.id === ARRIVEE_ID) return 'finish' as const;
  return station.waterRefill === false ? 'unavailable' as const : 'refill' as const;
}

function getSolidState(station: AidStationFormItem, index: number) {
  if (station.id === ARRIVEE_ID) return 'finish' as const;
  if (index === 0) return 'available' as const;
  return station.solidRefill === false ? 'unavailable' as const : 'available' as const;
}

export function buildPlanSummary(
  plan: StoredRacePlan,
  productMap: Record<string, PlanProduct>,
): PlanSummary {
  const values = normalizeStoredPlanValues(plan);
  const sections = buildLiveRaceSections(plan, productMap);
  const sectionsByIndex = new Map(sections.map((section) => [section.sectionIndex, section] as const));
  const checkpoints = values.aidStations.map<PlanSummaryCheckpoint>((station, index) => {
    const previousSection = index > 0 ? sectionsByIndex.get(index - 1) : null;
    const arrivalMinute = index === 0 ? 0 : previousSection?.endMinute ?? 0;
    const supplies = groupSupplies(getStationSupplies(values, station, index), productMap);

    return {
      index,
      name: station.name,
      distanceKm: station.distanceKm,
      isStart: station.id === DEPART_ID || index === 0,
      isFinish: station.id === ARRIVEE_ID || index === values.aidStations.length - 1,
      arrivalMinute,
      pauseMinutes: Math.max(0, station.pauseMinutes ?? 0),
      supplies,
      waterState: getWaterState(station, index),
      solidState: getSolidState(station, index),
    };
  });
  const productTotals = mergeProductTotals(checkpoints.flatMap((checkpoint) => checkpoint.supplies));
  const totalProductUnits = productTotals.reduce((sum, product) => sum + product.quantity, 0);
  const totalCarbsG = productTotals.reduce((sum, product) => sum + product.carbsG, 0);
  const totalSodiumMg = productTotals.reduce((sum, product) => sum + product.sodiumMg, 0);
  const lastSection = sections[sections.length - 1];

  return {
    id: plan.id,
    name: plan.name,
    distanceKm: values.raceDistanceKm,
    elevationGainM: values.elevationGain,
    waterBagLiters: values.waterBagLiters,
    targetCarbsPerHour: values.targetIntakePerHour,
    targetWaterPerHour: values.waterIntakePerHour,
    targetSodiumPerHour: values.sodiumIntakePerHour,
    totalDurationMin: lastSection?.endMinute ?? 0,
    totalProductUnits,
    totalCarbsG,
    totalSodiumMg,
    productTotals,
    checkpoints,
  };
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function formatClock(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatDuration(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours <= 0) return `${safeMinutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, '0')}`;
}

export function formatKm(distanceKm: number) {
  const rounded = Number(distanceKm.toFixed(1));
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${formatted} km`;
}

export function formatCheckpointTime(checkpoint: PlanSummaryCheckpoint, departureTime?: Date | null) {
  const elapsed = `T+${formatDuration(checkpoint.arrivalMinute)}`;
  if (!departureTime) return elapsed;
  return `${elapsed} / ${formatClock(addMinutes(departureTime, checkpoint.arrivalMinute))}`;
}

function getWaterLabel(
  checkpoint: PlanSummaryCheckpoint,
  waterBagLiters: number,
  locale: Locale,
) {
  const copy = SHARE_COPY[locale];
  if (checkpoint.waterState === 'full') {
    return copy.waterFull.replace('{liters}', String(waterBagLiters));
  }
  if (checkpoint.waterState === 'refill') return copy.waterRefill;
  if (checkpoint.waterState === 'finish') return copy.waterFinish;
  return copy.waterUnavailable;
}

function formatProductList(products: PlanSummaryProduct[], locale: Locale) {
  if (products.length === 0) return SHARE_COPY[locale].nothingToGive;
  return products.map((product) => `${product.name} x${product.quantity}`).join(', ');
}

export function buildPlanShareMessage(
  summary: PlanSummary,
  options: { locale: Locale; departureTime?: Date | null },
) {
  const copy = SHARE_COPY[options.locale];
  const lines = [
    `${copy.header} ${summary.name}`,
    `${copy.distance}: ${formatKm(summary.distanceKm)} | ${copy.elevation}: ${Math.round(summary.elevationGainM)} m`,
    `${copy.duration}: ${formatDuration(summary.totalDurationMin)}`,
  ];

  if (options.departureTime) {
    lines.push(`${copy.start}: ${formatClock(options.departureTime)}`);
  }

  lines.push('', `${copy.pack}:`);
  if (summary.productTotals.length === 0) {
    lines.push(`- ${copy.noProducts}`);
  } else {
    summary.productTotals.forEach((product) => {
      lines.push(`- ${product.name} x${product.quantity}`);
    });
  }

  lines.push('', `${copy.team}:`);
  summary.checkpoints.forEach((checkpoint) => {
    lines.push(`${checkpoint.name} - ${formatKm(checkpoint.distanceKm)} - ${formatCheckpointTime(checkpoint, options.departureTime)}`);
    lines.push(`${copy.give}: ${formatProductList(checkpoint.supplies, options.locale)}`);
    lines.push(`${copy.water}: ${getWaterLabel(checkpoint, summary.waterBagLiters, options.locale)}`);
    if (checkpoint.pauseMinutes > 0) {
      lines.push(`${copy.pause}: ${Math.round(checkpoint.pauseMinutes)} min`);
    }
    lines.push('');
  });

  return lines.join('\n').trim();
}
