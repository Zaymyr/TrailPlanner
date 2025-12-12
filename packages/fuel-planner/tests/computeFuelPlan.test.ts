import { describe, expect, it } from 'vitest';
import { computeFuelPlan, type AidStation, type FuelPlanInput } from '../computeFuelPlan';

describe('computeFuelPlan (tests folder)', () => {
  it('computes precise segment durations and ETAs with decimal paces', () => {
    const input: FuelPlanInput = {
      distanceKm: 11,
      startTime: '2024-06-15T06:15:00.000Z',
      effort: { type: 'pace', minutesPerKm: 5.5 },
      aidStations: [
        { name: 'Creek', distanceKm: 4.2 },
        { name: 'Ridge', distanceKm: 8.1 }
      ]
    };

    const plan = computeFuelPlan(input);

    expect(plan.segments.map((segment) => segment.durationMinutes)).toEqual([23.1, 21.5, 16]);
    expect(plan.segments.map((segment) => segment.cumulativeMinutes)).toEqual([23.1, 44.6, 60.6]);
    expect(plan.segments.map((segment) => segment.eta)).toEqual([
      '2024-06-15T06:38:06.000Z',
      '2024-06-15T06:59:36.000Z',
      '2024-06-15T07:15:36.000Z'
    ]);
  });

  it('aggregates nutrient and fluid totals across segments', () => {
    const input: FuelPlanInput = {
      distanceKm: 12,
      startTime: '2024-07-01T05:00:00.000Z',
      effort: { type: 'pace', minutesPerKm: 6 },
      aidStations: [{ name: 'Midpoint', distanceKm: 6 }],
      intakeRates: { carbsPerHour: 70, fluidsPerHour: 750, sodiumPerHour: 900 }
    };

    const plan = computeFuelPlan(input);

    expect(plan.segments.map((segment) => segment.intake)).toEqual([
      { carbsGrams: 42, fluidsMl: 450, sodiumMg: 540 },
      { carbsGrams: 42, fluidsMl: 450, sodiumMg: 540 }
    ]);
    expect(plan.totals).toMatchObject({
      carbsGrams: 84,
      fluidsMl: 900,
      sodiumMg: 1080,
      totalHours: 2
    });
  });

  describe('aid-station configurations', () => {
    it('handles courses with no aid stations', () => {
      const input: FuelPlanInput = {
        distanceKm: 5,
        effort: { type: 'speed', speedKmh: 10 }
      };

      const plan = computeFuelPlan(input);

      expect(plan.segments).toHaveLength(1);
      expect(plan.segments[0]).toMatchObject({ fromKm: 0, toKm: 5, distanceKm: 5 });
      expect(plan.segments[0].label).toEqual({ en: 'Start → Finish', fr: 'Départ → Arrivée' });
    });

    it('keeps fluid-only plans clean when the sole station is water-only', () => {
      const input: FuelPlanInput = {
        distanceKm: 16,
        effort: { type: 'pace', minutesPerKm: 7 },
        aidStations: [{ name: 'Water Only', distanceKm: 8 }],
        intakeRates: { fluidsPerHour: 600 }
      };

      const plan = computeFuelPlan(input);

      expect(plan.segments.map((segment) => segment.intake)).toEqual([
        { fluidsMl: 560 },
        { fluidsMl: 560 }
      ]);
      expect(plan.totals.fluidsMl).toBe(1120);
      expect(plan.totals.carbsGrams).toBeUndefined();
      expect(plan.totals.sodiumMg).toBeUndefined();
    });

    it('sorts mixed stations and labels dropbag locations', () => {
      const aidStations: AidStation[] = [
        { name: 'Dropbag', distanceKm: 15 },
        { name: 'Water', distanceKm: 10 }
      ];

      const plan = computeFuelPlan({
        distanceKm: 25,
        effort: { type: 'pace', minutesPerKm: 6.5 },
        aidStations
      });

      expect(plan.segments.map((segment) => segment.distanceKm)).toEqual([10, 5, 10]);
      expect(plan.segments.map((segment) => segment.label)).toEqual([
        { en: 'Start → Water', fr: 'Départ → Water' },
        { en: 'Water → Dropbag', fr: 'Water → Dropbag' },
        { en: 'Dropbag → Finish', fr: 'Dropbag → Arrivée' }
      ]);
    });
  });
});
