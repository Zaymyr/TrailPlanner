import { describe, expect, it } from 'vitest';

import { buildCatalogProfileLayers, downsampleProfile } from './catalogCourseProfiles';

const climb = (lengthKm: number, low: number, high: number) => [
  { distanceKm: 0, elevationM: low },
  { distanceKm: lengthKm / 2, elevationM: high },
  { distanceKm: lengthKm, elevationM: low },
];

describe('downsampleProfile', () => {
  it('keeps real metres on evenly spaced, rebased distances', () => {
    const result = downsampleProfile(
      [
        { distanceKm: 2, elevationM: 100 },
        { distanceKm: 4, elevationM: 300 },
        { distanceKm: 3, elevationM: 200 },
      ],
      3,
    );
    expect(result).toEqual([
      { distanceKm: 0, elevationM: 100 },
      { distanceKm: 1, elevationM: 200 },
      { distanceKm: 2, elevationM: 300 },
    ]);
  });

  it('rejects unusable profiles', () => {
    expect(downsampleProfile(null, 10)).toBeNull();
    expect(downsampleProfile([{ distanceKm: 0, elevationM: 1 }], 10)).toBeNull();
    expect(downsampleProfile([{ distanceKm: 1, elevationM: 1 }, { distanceKm: 1, elevationM: 5 }], 10)).toBeNull();
    expect(downsampleProfile([{ distanceKm: Number.NaN, elevationM: 1 }, { distanceKm: 2, elevationM: 5 }], 10)).toBeNull();
  });
});

describe('buildCatalogProfileLayers', () => {
  it('orders longest first and scales widths on a shared distance axis', () => {
    const layers = buildCatalogProfileLayers(
      [
        { key: 'short', profile: climb(20, 500, 900) },
        { key: 'long', profile: climb(80, 400, 2400) },
        { key: 'none', profile: null },
      ],
      5,
    );
    expect(layers.map((layer) => layer.key)).toEqual(['long', 'short']);
    expect(layers.map((layer) => layer.rank)).toEqual([0, 1]);
    expect(layers[0].widthRatio).toBe(1);
    expect(layers[1].widthRatio).toBeCloseTo(0.25);
  });

  it('normalises every format on one shared elevation range', () => {
    const [long, short] = buildCatalogProfileLayers(
      [
        { key: 'long', profile: climb(80, 400, 2400) },
        { key: 'short', profile: climb(20, 400, 1400) },
      ],
      3,
    );
    expect(Math.max(...long.values)).toBe(1);
    expect(Math.min(...long.values)).toBe(0);
    expect(Math.max(...short.values)).toBeCloseTo(0.5);
  });

  it('returns no layer without usable profiles and caps the layer count', () => {
    expect(buildCatalogProfileLayers([{ key: 'a', profile: undefined }])).toEqual([]);
    const many = Array.from({ length: 8 }, (_, index) => ({ key: `f${index}`, profile: climb(10 + index, 100, 300) }));
    const layers = buildCatalogProfileLayers(many, 4, 3);
    expect(layers.map((layer) => layer.key)).toEqual(['f7', 'f6', 'f5']);
  });

  it('draws flat courses as a calm middle line', () => {
    const [layer] = buildCatalogProfileLayers([
      { key: 'flat', profile: [{ distanceKm: 0, elevationM: 10 }, { distanceKm: 5, elevationM: 10 }] },
    ], 4);
    expect(layer.values).toEqual([0.5, 0.5, 0.5, 0.5]);
  });
});
