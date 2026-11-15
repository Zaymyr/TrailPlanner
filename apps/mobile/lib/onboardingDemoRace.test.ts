import { describe, expect, it } from 'vitest';

import {
  ONBOARDING_DEMO_EVENT_ID,
  ONBOARDING_DEMO_PREFERRED_RACE_ID,
  resolveOnboardingDemoRace,
} from './onboardingDemoRace';

const race = (id: string, distance_km: number | null, open = true) => ({ id, distance_km, open });
const demoEvent = (races: ReturnType<typeof race>[]) => ({ id: ONBOARDING_DEMO_EVENT_ID, races });
const canOpen = (candidate: { open: boolean }) => candidate.open;

describe('resolveOnboardingDemoRace', () => {
  it('returns null when the demo event is not in the catalog', () => {
    expect(resolveOnboardingDemoRace([{ id: 'other', races: [race('a', 10)] }], canOpen)).toBeNull();
  });

  it('prefers the TST 18 format when its RaceBook can be opened', () => {
    const result = resolveOnboardingDemoRace(
      [demoEvent([race('long', 5), race(ONBOARDING_DEMO_PREFERRED_RACE_ID, 18.4)])],
      canOpen,
    );
    expect(result?.race.id).toBe(ONBOARDING_DEMO_PREFERRED_RACE_ID);
  });

  it('falls back to the shortest openable format', () => {
    const result = resolveOnboardingDemoRace(
      [demoEvent([
        race(ONBOARDING_DEMO_PREFERRED_RACE_ID, 18.4, false),
        race('82', 82),
        race('42', 42),
        race('unknown', null),
      ])],
      canOpen,
    );
    expect(result?.race.id).toBe('42');
  });

  it('returns null when no demo format has an openable RaceBook', () => {
    expect(resolveOnboardingDemoRace([demoEvent([race('42', 42, false)])], canOpen)).toBeNull();
  });
});
