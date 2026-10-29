import { describe, expect, it } from 'vitest';

import {
  buildSupporterDirectionsUrl,
  hasVisibleRacebookSupporterPoints,
  parseRacebookSupporterPoints,
} from './racebookSupporterPoints';

describe('supporter point directions', () => {
  it('prefers the organizer Maps link', () => {
    expect(buildSupporterDirectionsUrl({ googleMapsUrl: 'https://maps.example/point', latitude: 45, longitude: 6 }))
      .toBe('https://maps.example/point');
  });

  it('falls back to coordinates', () => {
    expect(buildSupporterDirectionsUrl({ googleMapsUrl: null, latitude: 45.2, longitude: 6.3 }))
      .toBe('https://www.google.com/maps/dir/?api=1&destination=45.2,6.3');
  });

  it('keeps the additive collection optional and filters incomplete rows', () => {
    expect(parseRacebookSupporterPoints(undefined)).toEqual([]);
    expect(parseRacebookSupporterPoints([
      { id: 'draft', name: 'Brouillon', km: null, latitude: null, longitude: null, encouragement_allowed: true },
      { id: 's2', name: 'Village', km: 20, order_index: 1, latitude: 45.2, longitude: 6.2, encouragement_allowed: false, assistance_allowed: true },
      { id: 's1', name: 'Col', km: 10, order_index: 0, latitude: 45.1, longitude: 6.1, encouragement_allowed: true, assistance_allowed: false },
    ]).map((point) => point.id)).toEqual(['s1', 's2']);
  });

  it('uses the server-filtered collection as the tab visibility authority', () => {
    const points = parseRacebookSupporterPoints([
      { id: 's1', name: 'Col', km: 10, order_index: 0, latitude: 45.1, longitude: 6.1, encouragement_allowed: true },
    ]);

    expect(hasVisibleRacebookSupporterPoints(points)).toBe(true);
    expect(hasVisibleRacebookSupporterPoints([])).toBe(false);
  });
});
