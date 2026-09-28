import { describe, expect, it } from 'vitest';

import { isCatalogEventVisible } from './catalogVisibility';

const NOW = new Date(2026, 8, 28, 15, 30);

describe('isCatalogEventVisible', () => {
  it('keeps future, current-day, undated, and malformed events visible', () => {
    expect(isCatalogEventVisible('2026-09-29', false, NOW)).toBe(true);
    expect(isCatalogEventVisible('2026-09-28', false, NOW)).toBe(true);
    expect(isCatalogEventVisible(null, false, NOW)).toBe(true);
    expect(isCatalogEventVisible('not-a-date', false, NOW)).toBe(true);
    expect(isCatalogEventVisible('2026-02-31', false, NOW)).toBe(true);
  });

  it('hides a past event when it is not a favorite', () => {
    expect(isCatalogEventVisible('2026-09-27', false, NOW)).toBe(false);
  });

  it('keeps a favorite event visible for fourteen calendar days after its date', () => {
    expect(isCatalogEventVisible('2026-09-14', true, NOW)).toBe(true);
  });

  it('hides a favorite event after the fourteen-day retention window', () => {
    expect(isCatalogEventVisible('2026-09-13', true, NOW)).toBe(false);
  });
});
