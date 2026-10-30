import { describe, expect, it } from 'vitest';
import { parseRunnerProfile, type RunnerProfileDraft } from './runnerProfile';
const valid: RunnerProfileDraft = { firstName: 'Alice', pace: '7:30', water: '1,5', carbs: '60', birthDate: '', height: '', weight: '', utmb: '' };
describe('runner profile', () => {
  it('accepts minute/second pace and French decimals', () => expect(parseRunnerProfile(valid)).toMatchObject({ comfortable_flat_pace_min_per_km: 7.5, water_bag_liters: 1.5, birth_date: null }));
  it.each([{ pace: '7:99' }, { carbs: 'NaN' }, { water: '-1' }, { height: '90' }, { weight: '0' }, { birthDate: '2000-02-31' }, { utmb: '2001' }])('rejects invalid input %j', (patch) => expect(parseRunnerProfile({ ...valid, ...patch })).toBeNull());
});
