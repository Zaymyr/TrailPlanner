import {
  ARRIVEE_ID,
  DEPART_ID,
  type AidStationFormItem,
  type PlanFormValues,
  type Supply,
} from '../components/plan-form/contracts';

function normalizeStationName(name: string) {
  return name
    .trim()
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

type AidStationIdentity = Partial<Pick<AidStationFormItem, 'id' | 'name' | 'distanceKm'>>;

export function isSystemAidStation(station: AidStationIdentity) {
  if (station.id === DEPART_ID || station.id === ARRIVEE_ID) return true;

  const normalizedName = normalizeStationName(station.name ?? '');
  return (
    ((normalizedName === 'depart' || normalizedName === 'start') && station.distanceKm === 0) ||
    normalizedName === 'arrivee' ||
    normalizedName === 'finish'
  );
}

function normalizeSupplies(supplies: Supply[] | undefined) {
  return (supplies ?? []).map((supply) => ({
    productId: supply.productId,
    quantity: supply.quantity,
  }));
}

export function normalizeAidStationsForPersistence(aidStations: AidStationFormItem[]) {
  return aidStations
    .filter((station) => !isSystemAidStation(station))
    .map((station) => ({
      name: station.name,
      distanceKm: station.distanceKm,
      waterRefill: station.waterRefill !== false,
      solidRefill: station.solidRefill !== false,
      assistanceAllowed: station.assistanceAllowed !== false,
      pauseMinutes: Math.max(0, station.pauseMinutes ?? 0),
      supplies: station.assistanceAllowed === false ? [] : normalizeSupplies(station.supplies),
    }));
}

export function getIntermediateAidStationCount(aidStations: AidStationIdentity[] | null | undefined) {
  return (aidStations ?? []).filter((station) => !isSystemAidStation(station)).length;
}

export function normalizePlanValuesForPersistence(values: PlanFormValues): PlanFormValues {
  return {
    ...values,
    startSupplies: normalizeSupplies(values.startSupplies),
    aidStations: normalizeAidStationsForPersistence(values.aidStations),
  };
}

export function buildPersistedPlannerValues(values: PlanFormValues) {
  const normalized = normalizePlanValuesForPersistence(values);

  return {
    raceDistanceKm: normalized.raceDistanceKm,
    elevationGain: normalized.elevationGain,
    fatigueLevel: normalized.fatigueLevel,
    paceType: normalized.paceType,
    paceMinutes: normalized.paceMinutes,
    paceSeconds: normalized.paceSeconds,
    speedKph: normalized.speedKph,
    targetIntakePerHour: normalized.targetIntakePerHour,
    waterIntakePerHour: normalized.waterIntakePerHour,
    sodiumIntakePerHour: normalized.sodiumIntakePerHour,
    waterBagLiters: normalized.waterBagLiters,
    startSupplies: normalized.startSupplies,
    segments: normalized.sectionSegments,
    sectionSegments: normalized.sectionSegments,
    aidStations: normalized.aidStations,
  };
}

export function createPlanPersistenceSnapshot(values: PlanFormValues) {
  return JSON.stringify({
    name: values.name,
    plannerValues: buildPersistedPlannerValues(values),
  });
}
