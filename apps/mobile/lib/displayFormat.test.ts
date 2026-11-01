import { describe, expect, it } from 'vitest';

import {
  formatDistance,
  formatDistanceRange,
  formatElevation,
  formatDistanceValue,
  normalizeClockDisplay,
  parseLocalizedDecimal,
} from './displayFormat';

describe('mobile display formatting', () => {
  it('formats distances consistently in French and English', () => {
    expect(formatDistanceValue(0, 'fr')).toBe('0');
    expect(formatDistanceValue(9.36, 'fr')).toBe('9,4');
    expect(formatDistanceValue(184.74, 'fr')).toBe('184,7');
    expect(formatDistanceValue(9.36, 'en')).toBe('9.4');
    expect(formatDistance(26.04, 'fr')).toBe('26 km');
    expect(formatDistanceRange(0, 9.36, 'fr')).toBe('0–9,4 km');
  });

  it('accepts either decimal separator for numeric input', () => {
    expect(parseLocalizedDecimal('9,4')).toBe(9.4);
    expect(parseLocalizedDecimal('9.4')).toBe(9.4);
    expect(parseLocalizedDecimal('')).toBeNull();
    expect(parseLocalizedDecimal('distance')).toBeNull();
  });

  it('normalizes simple clock values without rewriting rich copy', () => {
    expect(normalizeClockDisplay('8:30')).toBe('08:30');
    expect(normalizeClockDisplay('09:00:00')).toBe('09:00');
    expect(normalizeClockDisplay('À partir de 8h')).toBe('À partir de 8h');
  });

  it('formats elevation with a locale thousands separator and a metre unit', () => {
    expect(formatElevation(860, 'fr')).toBe('860 m');
    expect(formatElevation(5120, 'fr').replace(/\s/g, ' ')).toBe('5 120 m');
    expect(formatElevation(5120.4, 'en')).toBe('5,120 m');
    expect(formatElevation(Number.NaN, 'fr')).toBe('0 m');
  });
});
