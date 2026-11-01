import { describe, expect, it } from 'vitest';

import { fr } from '../locales/fr';

function localizedStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).flatMap(localizedStrings);
}

describe('French typography', () => {
  it('uses the typographic ellipsis in visible copy', () => {
    expect(localizedStrings(fr).filter((value) => value.includes('...'))).toEqual([]);
  });

  it('keeps the lot 8 launch copy free of straight apostrophes', () => {
    const launchCopy = [fr.common.loading, fr.planSummary.shareLinkCreating, fr.catalog.organizerUpdatesLoading];
    expect(launchCopy.filter((value) => /[A-Za-zÀ-ÿ]'[A-Za-zÀ-ÿ]/.test(value))).toEqual([]);
  });
});
