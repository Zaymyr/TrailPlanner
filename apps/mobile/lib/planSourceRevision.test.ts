import { describe, expect, it } from 'vitest';

import { isPlanSourceRevisionPending } from './planSourceRevision';

describe('isPlanSourceRevisionPending', () => {
  it('requires a valid current official revision', () => {
    expect(isPlanSourceRevisionPending(null, null)).toBe(false);
    expect(isPlanSourceRevisionPending('invalid', null)).toBe(false);
  });

  it('flags a valid revision that was never explicitly reviewed', () => {
    expect(isPlanSourceRevisionPending('2026-10-29T10:00:00.000Z', null)).toBe(true);
  });

  it('flags only revisions newer than the explicit review', () => {
    expect(isPlanSourceRevisionPending(
      '2026-10-29T10:00:00.000Z',
      '2026-10-29T09:59:59.000Z',
    )).toBe(true);
    expect(isPlanSourceRevisionPending(
      '2026-10-29T10:00:00.000Z',
      '2026-10-29T10:00:00.000Z',
    )).toBe(false);
    expect(isPlanSourceRevisionPending(
      '2026-10-29T10:00:00.000Z',
      '2026-10-29T10:00:01.000Z',
    )).toBe(false);
  });

  it('treats an invalid stored review as not reviewed', () => {
    expect(isPlanSourceRevisionPending('2026-10-29T10:00:00.000Z', 'invalid')).toBe(true);
  });
});
