import { describe, expect, it } from 'vitest';

import {
  SIGNATURE_RIDGE,
  asTrailProfile,
  capLeanForWidth,
  buildContourPaths,
  buildRidgeAreaPath,
  buildRidgePath,
  formatCoteUnit,
  resampleProfile,
  ridgeLength,
  ridgePoints,
  ridgeSummit,
  createTrailRandom,
  hashTrailKey,
  mulberry32,
  parseTrailSeed,
  splitCoteLabel,
} from './trailSignature';

const frame = { width: 100, height: 40, inset: 2 };

describe('trail signature profile resampling', () => {
  it('normalizes a course profile to evenly spaced 0..1 samples', () => {
    const values = resampleProfile([
      { distanceKm: 0, elevationM: 500 },
      { distanceKm: 5, elevationM: 1500 },
      { distanceKm: 10, elevationM: 1000 },
    ], 5);
    expect(values).toEqual([0, 0.5, 1, 0.75, 0.5]);
  });

  it('sorts unordered points and ignores invalid ones', () => {
    const values = resampleProfile([
      { distanceKm: 10, elevationM: 200 },
      { distanceKm: Number.NaN, elevationM: 900 },
      { distanceKm: 0, elevationM: 100 },
    ], 3);
    expect(values).toEqual([0, 0.5, 1]);
  });

  it('refuses profiles that cannot draw a ridge', () => {
    expect(resampleProfile(null, 10)).toBeNull();
    expect(resampleProfile([{ distanceKm: 0, elevationM: 10 }], 10)).toBeNull();
    expect(resampleProfile([
      { distanceKm: 3, elevationM: 10 },
      { distanceKm: 3, elevationM: 20 },
    ], 10)).toBeNull();
  });

  it('narrows stored profiles defensively', () => {
    expect(asTrailProfile(null)).toBeNull();
    expect(asTrailProfile([{ distanceKm: 0, elevationM: 1 }])).toBeNull();
    expect(asTrailProfile([
      { distanceKm: 0, elevationM: 1 },
      { distanceKm: '1', elevationM: 2 },
      { distanceKm: 2, elevationM: 3 },
    ])).toEqual([
      { distanceKm: 0, elevationM: 1 },
      { distanceKm: 2, elevationM: 3 },
    ]);
  });

  it('renders a flat course as a calm mid-height line', () => {
    expect(resampleProfile([
      { distanceKm: 0, elevationM: 10 },
      { distanceKm: 5, elevationM: 10.4 },
    ], 3)).toEqual([0.5, 0.5, 0.5]);
  });
});

describe('trail signature ridge geometry', () => {
  it('keeps every point inside the inset frame', () => {
    const points = ridgePoints(SIGNATURE_RIDGE, frame);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(2);
      expect(point.x).toBeLessThanOrEqual(98);
      expect(point.y).toBeGreaterThanOrEqual(2);
      expect(point.y).toBeLessThanOrEqual(38);
    }
    expect(points[0].x).toBe(2);
    expect(points[points.length - 1].x).toBe(98);
  });

  it('builds smooth open and closed paths', () => {
    const line = buildRidgePath([0, 1, 0], frame);
    expect(line.startsWith('M2 38')).toBe(true);
    expect(line.match(/C/g)).toHaveLength(2);
    const area = buildRidgeAreaPath([0, 1, 0], frame);
    expect(area.endsWith('L98 40 L2 40 Z')).toBe(true);
  });

  it('never lets curve control points overshoot the frame', () => {
    const numbers = buildRidgePath([0, 1, 0, 1, 0], frame).match(/-?\d+(\.\d+)?/g)!.map(Number);
    const ys = numbers.filter((_, index) => index % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...ys)).toBeLessThanOrEqual(38);
  });

  it('finds the summit and a drawable length', () => {
    expect(ridgeSummit([0.2, 0.9, 1, 0.4], frame).index).toBe(2);
    expect(ridgeSummit([], frame).index).toBe(-1);
    expect(ridgeLength([0, 0], { width: 100, height: 10 })).toBe(108);
  });

  it('nests contour bands below the main ridge', () => {
    const paths = buildContourPaths(SIGNATURE_RIDGE, { width: 320, height: 160 }, 4);
    expect(paths).toHaveLength(4);
    expect(paths[0]).toBe(buildRidgePath(SIGNATURE_RIDGE, { width: 320, height: 160 }));
    expect(new Set(paths).size).toBe(4);
    expect(buildContourPaths([0.5], { width: 10, height: 10 })).toEqual([]);
  });
});

describe('trail signature cotes', () => {
  it('splits formatted measurements into value and unit', () => {
    expect(splitCoteLabel('1 240 m')).toEqual({ value: '1 240', unit: 'm' });
    expect(splitCoteLabel('42,3 km')).toEqual({ value: '42,3', unit: 'km' });
    expect(splitCoteLabel('60 g/h')).toEqual({ value: '60', unit: 'g/h' });
    expect(splitCoteLabel('5:30 min/km')).toEqual({ value: '5:30', unit: 'min/km' });
    expect(splitCoteLabel('12%')).toEqual({ value: '12', unit: '%' });
  });

  it('keeps labels without a symbolic unit intact', () => {
    expect(splitCoteLabel('4h30')).toEqual({ value: '4h30', unit: null });
    expect(splitCoteLabel('—')).toEqual({ value: '—', unit: null });
    expect(splitCoteLabel('3 ravitaillements')).toEqual({ value: '3 ravitaillements', unit: null });
    expect(splitCoteLabel(null)).toEqual({ value: '—', unit: null });
    expect(splitCoteLabel(7)).toEqual({ value: '7', unit: null });
  });

  it('typesets units as compact capitals', () => {
    expect(formatCoteUnit('km')).toBe('KM');
    expect(formatCoteUnit('g/h')).toBe('G/H');
  });
});

describe('trail variation', () => {
  const labels = ['Ouvrir dans Maps', 'Livret coureur', 'Créer un plan', 'Voir mon plan', 'Tracé', 'Ravitos', 'Où encourager', 'Relais'];

  it('is deterministic for a seed and key, whatever the draw order', () => {
    const first = createTrailRandom(42, 'sign|Livret coureur');
    const tilt = first.lean('tilt', [0.4, 2.9]);
    const dy = first.jitter('dy', 1.5);
    const again = createTrailRandom(42, 'sign|Livret coureur');
    expect(again.jitter('dy', 1.5)).toBe(dy);
    expect(again.lean('tilt', [0.4, 2.9])).toBe(tilt);
    expect(hashTrailKey('abc')).toBe(hashTrailKey('abc'));
    const prng = mulberry32(7);
    const values = [prng(), prng(), prng()];
    const replay = mulberry32(7);
    expect([replay(), replay(), replay()]).toEqual(values);
  });

  it('changes with the launch seed', () => {
    const tilts = (seed: number) => labels.map((label) => createTrailRandom(seed, label).lean('tilt', [0.4, 2.9]));
    expect(tilts(1)).not.toEqual(tilts(2));
  });

  it('stays within the token ranges and leans both ways', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      for (const label of labels) {
        const random = createTrailRandom(seed, label);
        const tilt = random.lean('tilt', [0.4, 2.9]);
        expect(Math.abs(tilt)).toBeGreaterThanOrEqual(0.4);
        expect(Math.abs(tilt)).toBeLessThanOrEqual(2.9);
        expect(Math.abs(random.jitter('dy', 1.5))).toBeLessThanOrEqual(1.5);
        const stamp = random.between('stamp', [-10, -4]);
        expect(stamp).toBeGreaterThanOrEqual(-10);
        expect(stamp).toBeLessThanOrEqual(-4);
        const texture = random.pick('texture', 4);
        expect(texture).toBeGreaterThanOrEqual(0);
        expect(texture).toBeLessThan(4);
      }
    }
    const tilts = labels.map((label) => createTrailRandom(3, label).lean('tilt', [0.4, 2.9]));
    expect(tilts.some((tilt) => tilt > 0)).toBe(true);
    expect(tilts.some((tilt) => tilt < 0)).toBe(true);
  });

  it('is neutral when the variation amount is 0 (disabled, destructive, reduced)', () => {
    const neutral = createTrailRandom(42, 'sign|Livret coureur', 0);
    expect(neutral.lean('tilt', [0.4, 2.9])).toBe(0);
    expect(neutral.jitter('dy', 1.5)).toBe(0);
    expect(neutral.between('stamp', [-10, -4])).toBe(0);
    expect(neutral.pick('texture', 4)).toBe(0);
    expect(neutral.chance('missing', 1)).toBe(false);
  });

  it('scales with the global amount', () => {
    const full = createTrailRandom(9, 'k').lean('tilt', [1, 2]);
    const half = createTrailRandom(9, 'k', 0.5).lean('tilt', [1, 2]);
    expect(Math.abs(half - full / 2)).toBeLessThanOrEqual(0.01);
  });

  it('caps the lean of wide elements by their width, keeping short ones', () => {
    // Short sign: full token lean stays.
    expect(capLeanForWidth(2.9, 120)).toBe(2.9);
    expect(capLeanForWidth(-2.9, 120)).toBe(-2.9);
    // Full-width sign (~340pt): the tip drifts by at most ~4.5pt.
    const wide = capLeanForWidth(2.9, 340);
    expect(wide).toBeLessThan(2.9);
    expect(170 * Math.tan((wide * Math.PI) / 180)).toBeLessThanOrEqual(4.55);
    expect(capLeanForWidth(-2.9, 340)).toBe(-wide);
    // Neutral and unmeasured elements stay upright.
    expect(capLeanForWidth(0, 340)).toBe(0);
    expect(capLeanForWidth(2.9, 0)).toBe(0);
  });

  it('parses forced seeds', () => {
    expect(parseTrailSeed('42')).toBe(42);
    expect(parseTrailSeed(7)).toBe(7);
    expect(parseTrailSeed('')).toBeNull();
    expect(parseTrailSeed('abc')).toBeNull();
    expect(parseTrailSeed(0)).toBeNull();
    expect(parseTrailSeed(undefined)).toBeNull();
  });
});
