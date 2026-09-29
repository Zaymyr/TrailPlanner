import { describe, expect, it } from 'vitest';

import { parseRequestedDate } from './raceRequestDate';

describe('parseRequestedDate', () => {
  it('normalizes the advertised local and ISO formats', () => {
    expect(parseRequestedDate('07/11/2026')).toBe('2026-11-07');
    expect(parseRequestedDate('07.11.2026')).toBe('2026-11-07');
    expect(parseRequestedDate('07-11-2026')).toBe('2026-11-07');
    expect(parseRequestedDate('2026-11-07')).toBe('2026-11-07');
  });

  it('accepts real leap days and rejects impossible calendar dates', () => {
    expect(parseRequestedDate('29/02/2028')).toBe('2028-02-29');
    expect(parseRequestedDate('29/02/2026')).toBeNull();
    expect(parseRequestedDate('31/04/2026')).toBeNull();
    expect(parseRequestedDate('00/11/2026')).toBeNull();
  });

  it('rejects unsupported or incomplete formats', () => {
    expect(parseRequestedDate('7/11/2026')).toBeNull();
    expect(parseRequestedDate('11/07/26')).toBeNull();
    expect(parseRequestedDate('')).toBeNull();
  });
});
