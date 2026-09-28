import { describe, expect, it } from 'vitest';

import {
  filterCatalogRacesByEditionRetention,
  isCatalogEventVisible,
} from './catalogVisibility';

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

describe('filterCatalogRacesByEditionRetention', () => {
  const previousEdition = [
    { id: 'old-short', edition_id: 'edition-2026', race_date: '2026-09-12' },
    { id: 'old-long', edition_id: 'edition-2026', race_date: '2026-09-14' },
  ];
  const nextEdition = [
    { id: 'new', edition_id: 'edition-2027', race_date: '2027-09-18' },
  ];

  it('keeps both online editions through the fourteenth day after the older edition ends', () => {
    expect(filterCatalogRacesByEditionRetention(
      [...previousEdition, ...nextEdition],
      NOW,
    )).toEqual([...previousEdition, ...nextEdition]);
  });

  it('keeps only the newest online edition from day fifteen onward', () => {
    expect(filterCatalogRacesByEditionRetention(
      [...previousEdition, ...nextEdition],
      new Date(2026, 8, 29, 9),
    )).toEqual(nextEdition);
  });

  it('uses the latest visible race date as the end of a multi-day edition', () => {
    expect(filterCatalogRacesByEditionRetention(
      [...previousEdition, ...nextEdition],
      new Date(2026, 8, 28, 23, 59),
    )).toEqual([...previousEdition, ...nextEdition]);
  });

  it('does not remove legacy or malformed rows whose edition date cannot be established', () => {
    const legacyRace = { id: 'legacy', edition_id: null, race_date: '2025-01-01' };
    const malformedRace = { id: 'malformed', edition_id: 'unknown', race_date: 'not-a-date' };

    expect(filterCatalogRacesByEditionRetention(
      [...previousEdition, ...nextEdition, legacyRace, malformedRace],
      new Date(2026, 8, 29),
    )).toEqual([...nextEdition, legacyRace, malformedRace]);
  });

  it('leaves a single known edition unchanged', () => {
    expect(filterCatalogRacesByEditionRetention(previousEdition, NOW)).toBe(previousEdition);
  });
});
