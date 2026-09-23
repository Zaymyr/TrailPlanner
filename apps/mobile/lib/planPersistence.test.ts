import { describe, expect, it } from 'vitest';

import { ARRIVEE_ID, DEPART_ID, type PlanFormValues } from '../components/plan-form/contracts';
import {
  buildPersistedPlannerValues,
  createPlanPersistenceSnapshot,
  getIntermediateAidStationCount,
  normalizeAidStationsForPersistence,
} from './planPersistence';

function makeValues(aidStations: PlanFormValues['aidStations']): PlanFormValues {
  return {
    name: 'Plan test',
    raceDistanceKm: 42,
    elevationGain: 1800,
    fatigueLevel: 0.5,
    paceType: 'pace',
    paceMinutes: 7,
    paceSeconds: 30,
    speedKph: 8,
    targetIntakePerHour: 70,
    waterIntakePerHour: 500,
    sodiumIntakePerHour: 600,
    waterBagLiters: 1.5,
    startSupplies: [{ productId: 'start-gel', quantity: 2 }],
    aidStations,
  };
}

describe('plan persistence', () => {
  it('stores only intermediate aid stations from editor values', () => {
    const values = makeValues([
      { id: DEPART_ID, name: 'Départ', distanceKm: 0, waterRefill: true },
      {
        id: 'station-1',
        name: 'Col du Test',
        distanceKm: 18,
        waterRefill: true,
        solidRefill: false,
        assistanceAllowed: false,
        pauseMinutes: -4,
        supplies: [{ productId: 'gel', quantity: 3 }],
      },
      { id: ARRIVEE_ID, name: 'Arrivée', distanceKm: 42, waterRefill: false },
    ]);

    expect(normalizeAidStationsForPersistence(values.aidStations)).toEqual([
      {
        name: 'Col du Test',
        distanceKm: 18,
        waterRefill: true,
        solidRefill: false,
        assistanceAllowed: false,
        pauseMinutes: 0,
        supplies: [],
      },
    ]);
    expect(buildPersistedPlannerValues(values).aidStations).toHaveLength(1);
    expect(getIntermediateAidStationCount(values.aidStations)).toBe(1);
  });

  it('removes legacy system stations that do not have canonical ids', () => {
    const stations = [
      { name: 'Départ', distanceKm: 0, waterRefill: true },
      { name: 'Ravito 1', distanceKm: 12, waterRefill: true },
      { name: 'Arrivée', distanceKm: 42, waterRefill: false },
    ];

    expect(normalizeAidStationsForPersistence(stations).map((station) => station.name)).toEqual(['Ravito 1']);
  });

  it('uses the canonical payload for dirty-state snapshots', () => {
    const stored = makeValues([{ name: 'Ravito 1', distanceKm: 12, waterRefill: true }]);
    const editor = makeValues([
      { id: DEPART_ID, name: 'Départ', distanceKm: 0, waterRefill: true },
      { name: 'Ravito 1', distanceKm: 12, waterRefill: true },
      { id: ARRIVEE_ID, name: 'Arrivée', distanceKm: 42, waterRefill: false },
    ]);

    expect(createPlanPersistenceSnapshot(editor)).toBe(createPlanPersistenceSnapshot(stored));
  });
});
