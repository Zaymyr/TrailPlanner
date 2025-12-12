import { describe, expect, it } from 'vitest';
import { computeFuelPlan, type AidStation, type FuelPlanInput } from '../computeFuelPlan';

describe('computeFuelPlan', () => {
  it('builds segments from pace input with ETAs and rounded totals', () => {
    const aidStations: AidStation[] = [
      { name: 'Summit', distanceKm: 12 },
      { name: 'River', distanceKm: 5 }
    ];

    const input: FuelPlanInput = {
      distanceKm: 20,
      startTime: '2024-06-01T08:00:00.000Z',
      effort: { type: 'pace', minutesPerKm: 6 },
      aidStations,
      intakeRates: { carbsPerHour: 60, fluidsPerHour: 500, sodiumPerHour: 800 }
    };

    const plan = computeFuelPlan(input);

    expect(plan.segments.map((segment) => segment.distanceKm)).toEqual([5, 7, 8]);
    expect(plan.segments.map((segment) => segment.durationMinutes)).toEqual([30, 42, 48]);
    expect(plan.segments.map((segment) => segment.eta)).toEqual([
      '2024-06-01T08:30:00.000Z',
      '2024-06-01T09:12:00.000Z',
      '2024-06-01T10:00:00.000Z'
    ]);

    expect(plan.totals.totalHours).toBeCloseTo(2, 2);
    expect(plan.totals.carbsGrams).toBe(120);
    expect(plan.totals.fluidsMl).toBe(1000);
    expect(plan.totals.sodiumMg).toBe(1600);
  });

  it('accepts speed input and computes durations accordingly', () => {
    const input: FuelPlanInput = {
      distanceKm: 15,
      startTime: '2024-01-01T07:00:00.000Z',
      effort: { type: 'speed', speedKmh: 10 }
    };

    const plan = computeFuelPlan(input);

    expect(plan.segments).toHaveLength(1);
    expect(plan.segments[0].durationMinutes).toBeCloseTo(90);
    expect(plan.segments[0].eta).toBe('2024-01-01T08:30:00.000Z');
    expect(plan.totals.totalHours).toBeCloseTo(1.5);
  });

  it('sorts aid stations by distance and aggregates segment labels bilingually', () => {
    const input: FuelPlanInput = {
      distanceKm: 10,
      effort: { type: 'pace', minutesPerKm: 5 },
      aidStations: [
        { name: 'Mi-parcours', distanceKm: 6 },
        { name: 'Premier arrêt', distanceKm: 3 }
      ]
    };

    const plan = computeFuelPlan(input);

    const labels = plan.segments.map((segment) => segment.label);

    expect(labels[0]).toEqual({ en: 'Start → Premier arrêt', fr: 'Départ → Premier arrêt' });
    expect(labels[1]).toEqual({ en: 'Premier arrêt → Mi-parcours', fr: 'Premier arrêt → Mi-parcours' });
    expect(labels[2]).toEqual({ en: 'Mi-parcours → Finish', fr: 'Mi-parcours → Arrivée' });
  });
});
