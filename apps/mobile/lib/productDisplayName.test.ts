import { describe, expect, it } from 'vitest';

import { formatProductDisplayName } from './productDisplayName';

describe('formatProductDisplayName', () => {
  it('normalizes all-uppercase catalog labels', () => {
    expect(formatProductDisplayName('GEL ÉNERGÉTIQUE CITRON')).toBe('Gel Énergétique Citron');
  });

  it('preserves known acronyms', () => {
    expect(formatProductDisplayName('BARRE UTMB BCAA')).toBe('Barre UTMB BCAA');
  });

  it('leaves intentionally mixed-case labels untouched', () => {
    expect(formatProductDisplayName('Drink Mix 320')).toBe('Drink Mix 320');
  });
});
