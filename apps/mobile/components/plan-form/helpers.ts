import { ARRIVEE_ID, DEPART_ID, type AidStationFormItem, type FavProduct, type PlanFormValues, type Supply } from './contracts';
import type { SectionSegment } from './profile-utils';

export function normalizeSupplies(raw: Array<{ productId: string; quantity?: number }> | undefined): Supply[] {
  if (!raw) return [];
  return raw.map((supply) => ({ productId: supply.productId, quantity: supply.quantity ?? 1 }));
}

export function cloneSectionSegments(
  raw: Record<string, SectionSegment[]> | undefined,
): Record<string, SectionSegment[]> | undefined {
  if (!raw) return undefined;
  const entries = Object.entries(raw).map(([key, segments]) => [key, segments.map((segment) => ({ ...segment }))] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function injectSystemStations(stations: AidStationFormItem[], distanceKm: number): AidStationFormItem[] {
  const intermediates = stations.filter(
    (station) =>
      station.id !== DEPART_ID &&
      station.id !== ARRIVEE_ID &&
      !(station.name === 'Départ' && station.distanceKm === 0) &&
      station.name !== 'Arrivée',
  );

  return [
    { id: DEPART_ID, name: 'Départ', distanceKm: 0, waterRefill: true, supplies: [] },
    ...intermediates,
    { id: ARRIVEE_ID, name: 'Arrivée', distanceKm, waterRefill: false },
  ];
}

export function buildInitialPlanValues(initialValues: PlanFormValues): PlanFormValues {
  return {
    ...initialValues,
    startSupplies: normalizeSupplies(initialValues.startSupplies),
    sectionSegments: cloneSectionSegments(initialValues.sectionSegments),
    aidStations: injectSystemStations(
      initialValues.aidStations.map((station) => ({ ...station, supplies: normalizeSupplies(station.supplies) })),
      initialValues.raceDistanceKm,
    ),
  };
}

export function buildPlanForTarget(targetFuelGrams: number, targetSodiumMg: number, products: FavProduct[]): Supply[] {
  if (!Number.isFinite(targetFuelGrams) || targetFuelGrams <= 0) return [];

  const options = [...products]
    .sort((a, b) => b.carbsGrams - a.carbsGrams)
    .slice(0, 3)
    .map((product) => ({
      id: product.id,
      carbs: Math.max(product.carbsGrams, 0),
      sodium: Math.max(product.sodiumMg ?? 0, 0),
    }));

  if (options.length === 0) return [];

  const minCarbs = Math.max(Math.min(...options.map((option) => option.carbs)), 1);
  const maxUnits = Math.min(12, Math.max(3, Math.ceil(targetFuelGrams / minCarbs) + 2));
  let best = { score: Number.POSITIVE_INFINITY, combo: [] as number[] };

  const evaluateCombo = (combo: number[]) => {
    const plannedCarbs = combo.reduce((total, qty, index) => total + qty * options[index].carbs, 0);
    const plannedSodium = combo.reduce((total, qty, index) => total + qty * options[index].sodium, 0);
    const carbDiff = Math.abs(plannedCarbs - targetFuelGrams) / Math.max(targetFuelGrams, 1);
    const sodiumDiff = targetSodiumMg > 0 ? Math.abs(plannedSodium - targetSodiumMg) / targetSodiumMg : 0;
    const underfillPenalty = plannedCarbs < targetFuelGrams ? 0.2 : 0;
    const itemPenalty = combo.reduce((sum, qty) => sum + qty, 0) * 0.01;
    const score = carbDiff * 1.5 + sodiumDiff * 0.5 + underfillPenalty + itemPenalty;
    if (score < best.score && plannedCarbs > 0) {
      best = { score, combo: combo.slice() };
    }
  };

  const search = (index: number, combo: number[], totalUnits: number) => {
    if (index === options.length) {
      evaluateCombo(combo);
      return;
    }

    const remainingSlots = maxUnits - totalUnits;
    for (let qty = 0; qty <= remainingSlots; qty += 1) {
      combo[index] = qty;
      search(index + 1, combo, totalUnits + qty);
    }
  };

  search(0, new Array(options.length).fill(0), 0);

  if (best.score === Number.POSITIVE_INFINITY || best.combo.every((qty) => qty === 0)) return [];

  return best.combo
    .map((qty, index) => ({ productId: options[index].id, quantity: qty }))
    .filter((supply) => supply.quantity > 0);
}

export function formatDurationLabel(durationMin: number): string {
  const roundedMinutes = Math.max(0, Math.round(durationMin));
  if (roundedMinutes >= 60) {
    const hours = Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    return `${hours}h${String(minutes).padStart(2, '0')}`;
  }
  return `${roundedMinutes} min`;
}
