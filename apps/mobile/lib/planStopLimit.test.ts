import { describe, expect, it } from 'vitest';

import { isPauseOverOrganizerLimit } from './planStopLimit';

describe('isPauseOverOrganizerLimit', () => {
  it('warns without blocking when the planned pause exceeds the organizer limit', () => {
    expect(isPauseOverOrganizerLimit(21, 20)).toBe(true);
    expect(isPauseOverOrganizerLimit(20, 20)).toBe(false);
    expect(isPauseOverOrganizerLimit(30, null)).toBe(false);
  });
});
