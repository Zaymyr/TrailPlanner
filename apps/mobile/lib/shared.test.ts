import { describe, expect, it } from 'vitest';

import {
  buildAlertSchedule,
  getAlertsToFire,
  type ActiveAlert,
  type RacePlan,
} from './shared';

function makePlan(): RacePlan {
  return {
    id: 'plan-1',
    name: 'Trail test',
    createdAt: '2026-09-16T08:00:00.000Z',
    updatedAt: '2026-09-16T08:00:00.000Z',
    elevationProfile: [],
    plannerValues: {
      raceDistanceKm: 20,
      elevationGain: 900,
      targetIntakePerHour: 60,
      waterIntakePerHour: 500,
      sodiumIntakePerHour: 300,
      waterBagLiters: 1.5,
      paceMinutes: 10,
      paceSeconds: 0,
      aidStations: [
        { name: 'Ravito 12', distanceKm: 12 },
        {
          name: 'Ravito 5',
          distanceKm: 5,
          segmentPlan: {
            carbsGrams: 42,
            waterMl: 375,
            sodiumMg: 210,
            durationMinutes: 50,
            distanceKm: 5,
            products: [
              { id: 'bar-1', name: 'Barre', carbsGrams: 21, sodiumMg: 105, quantity: 2 },
            ],
          },
        },
      ],
      finishPlan: {
        carbsGrams: 75,
        waterMl: 650,
        sodiumMg: 420,
        durationMinutes: 80,
        distanceKm: 8,
        gelsCount: 3,
      },
    },
  };
}

function activeAlert(overrides: Partial<ActiveAlert> = {}): ActiveAlert {
  return {
    id: 'alert-1',
    segmentIndex: 0,
    triggerMinutes: 10,
    title: 'Segment 1',
    body: 'Rappel',
    payload: {},
    status: 'pending',
    ...overrides,
  };
}

describe('buildAlertSchedule', () => {
  it('sorts stations without mutating the saved plan and schedules every segment cumulatively', () => {
    const plan = makePlan();

    const alerts = buildAlertSchedule(plan, 'time');

    expect(plan.plannerValues.aidStations.map((station) => station.distanceKm)).toEqual([12, 5]);
    expect(alerts.map((alert) => ({
      id: alert.id,
      triggerMinutes: alert.triggerMinutes,
      fromName: alert.payload.fromName,
      toName: alert.payload.toName,
      distanceKm: alert.payload.segmentDistanceKm,
    }))).toEqual([
      { id: 'seg-0', triggerMinutes: 0, fromName: 'Départ', toName: 'Ravito 5', distanceKm: 5 },
      { id: 'seg-1', triggerMinutes: 50, fromName: 'Ravito 5', toName: 'Ravito 12', distanceKm: 7 },
      { id: 'seg-2', triggerMinutes: 120, fromName: 'Ravito 12', toName: 'Arrivée', distanceKm: 8 },
    ]);
  });

  it('prefers stored segment targets and product detail over hourly estimates', () => {
    const [firstAlert, , finishAlert] = buildAlertSchedule(makePlan(), 'time');

    expect(firstAlert.payload).toMatchObject({ carbsGrams: 42, waterMl: 375, sodiumMg: 210 });
    expect(firstAlert.body).toContain('2x Barre');
    expect(finishAlert.payload).toMatchObject({ carbsGrams: 75, waterMl: 650, sodiumMg: 420 });
    expect(finishAlert.body).toContain('3x Gel');
  });

  it('derives missing targets from the segment duration and hourly goals', () => {
    const [, middleAlert] = buildAlertSchedule(makePlan(), 'time');

    expect(middleAlert.payload).toMatchObject({
      carbsGrams: 70,
      waterMl: 583,
      sodiumMg: 350,
    });
  });
});

describe('getAlertsToFire', () => {
  it('fires pending and expired snoozed alerts at the exact boundary', () => {
    const pending = activeAlert({ id: 'pending', triggerMinutes: 10 });
    const snoozed = activeAlert({
      id: 'snoozed',
      status: 'snoozed',
      triggerMinutes: 1,
      snoozedUntilMinutes: 10,
    });

    expect(getAlertsToFire([pending, snoozed], 9.999)).toEqual([]);
    expect(getAlertsToFire([pending, snoozed], 10).map((alert) => alert.id)).toEqual([
      'pending',
      'snoozed',
    ]);
  });

  it('does not re-fire confirmed, skipped, or unscheduled snoozed alerts', () => {
    const alerts = [
      activeAlert({ id: 'confirmed', status: 'confirmed', triggerMinutes: 0 }),
      activeAlert({ id: 'skipped', status: 'skipped', triggerMinutes: 0 }),
      activeAlert({ id: 'snoozed-without-deadline', status: 'snoozed', triggerMinutes: 0 }),
    ];

    expect(getAlertsToFire(alerts, Number.MAX_SAFE_INTEGER)).toEqual([]);
  });
});
