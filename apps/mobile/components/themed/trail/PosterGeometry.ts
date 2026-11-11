import type { TrailRandom } from '../../../lib/trailSignature';

/**
 * Geometry of the pinned, slightly crumpled poster behind a TopoCard.
 * Every irregularity is drawn from the card's TrailRandom, so a card keeps
 * the same outline for the whole session. Edges only ever move inwards: the
 * paper never grows past the layout box, so nothing overlaps its neighbours.
 */

type Point = { x: number; y: number };

export type PosterTabs = {
  /** Height of the tear-off strip at the bottom of the poster. */
  height: number;
  count: number;
  /** Tab already torn off (cut out of the paper), or null. */
  missing: number | null;
  /** Tab hanging askew (drawn on its own, rotated around its hinge), or null. */
  skewed: number | null;
  skewAngle: number;
};

export type PosterShape = {
  width: number;
  height: number;
  /** Closed outline of the paper (clip path and fill). */
  outline: string;
  /** Inward offset of the left edge at a given y (to seat a leading-edge blaze). */
  leftInsetAt: (y: number) => number;
  tabs: PosterTabs | null;
};

const round = (value: number) => Math.round(value * 100) / 100;

/** Positions (fractions of the edge) of the irregular points, after the mockup. */
const TOP = [0.28, 0.55, 0.81];
const RIGHT = [0.38, 0.72];
const BOTTOM = [0.64, 0.31];
const LEFT = [0.61, 0.27];

/** Never pull an edge in by more than this, whatever the card size. */
const MAX_INSET = 4;
const TAB_WIDTH = 64;

type ShapeOptions = {
  width: number;
  height: number;
  radius: number;
  /** Maximum inward jitter as a fraction of the card size (e.g. 0.012). */
  edge: number;
  random: TrailRandom;
  tabs?: {
    height: number;
    missingEvery: number;
    skew: readonly [number, number];
  } | null;
};

export function buildPosterShape({ width, height, radius, edge, random, tabs }: ShapeOptions): PosterShape {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const inset = (name: string, size: number) => Math.min(MAX_INSET, random.between(name, [0, edge]) * size);

  const top = TOP.map((t, i): Point => ({ x: width * t, y: inset(`edge:top${i}`, height) }));
  const right = RIGHT.map((t, i): Point => ({ x: width - inset(`edge:right${i}`, width), y: height * t }));
  const bottomY = (i: number) => height - inset(`edge:bottom${i}`, height);
  const left = LEFT.map((t, i): Point => ({ x: inset(`edge:left${i}`, width), y: height * t }));

  let tabShape: PosterTabs | null = null;
  if (tabs && tabs.height > 0 && height > tabs.height + r) {
    const count = Math.max(4, Math.min(7, Math.round(width / TAB_WIDTH)));
    // `chance` is false on a neutral card: every tab stays in place.
    // About one tab in `missingEvery` is torn off: a single one on a phone card.
    const varied = random.chance('tabs:varied', 1) && Math.round(count / tabs.missingEvery) >= 1;
    const missing = varied ? random.pick('tabs:missing', count) : null;
    // The askew tab never touches the gap, so both read as separate accidents.
    const apart = missing == null ? [] : Array.from({ length: count }, (_, i) => i).filter((i) => Math.abs(i - missing) > 1);
    const skewed = apart.length > 0 ? apart[random.pick('tabs:skewed', apart.length)] : null;
    tabShape = {
      height: tabs.height,
      count,
      missing,
      skewed,
      skewAngle: skewed != null ? random.lean('tabs:skew', tabs.skew) : 0,
    };
  }

  const p = (point: Point) => `${round(point.x)} ${round(point.y)}`;
  let d = `M${round(r)} 0`;
  top.forEach((point) => { d += ` L${p(point)}`; });
  d += ` L${round(width - r)} 0 Q${round(width)} 0 ${round(width)} ${round(r)}`;
  right.forEach((point) => { d += ` L${p(point)}`; });

  if (tabShape) {
    // Square bottom corners: the strip is cut with scissors, tab by tab.
    const stripTop = height - tabShape.height;
    const tabWidth = width / tabShape.count;
    d += ` L${round(width)} ${round(height)}`;
    for (let i = tabShape.count - 1; i >= 0; i -= 1) {
      const x0 = i * tabWidth;
      const x1 = (i + 1) * tabWidth;
      if (i === tabShape.missing || i === tabShape.skewed) {
        d += ` L${round(x1)} ${round(stripTop)} L${round(x0)} ${round(stripTop)} L${round(x0)} ${round(height)}`;
      } else {
        d += ` L${round(x0)} ${round(height)}`;
      }
    }
    d += ` L0 ${round(stripTop)}`;
  } else {
    d += ` L${round(width)} ${round(height - r)} Q${round(width)} ${round(height)} ${round(width - r)} ${round(height)}`;
    BOTTOM.forEach((t, i) => { d += ` L${round(width * t)} ${round(bottomY(i))}`; });
    d += ` L${round(r)} ${round(height)} Q0 ${round(height)} 0 ${round(height - r)}`;
  }
  left.forEach((point) => { d += ` L${p(point)}`; });
  d += ` L0 ${round(r)} Q0 0 ${round(r)} 0 Z`;

  // Left edge as a polyline from top to bottom, for interpolation.
  const leftEdge: Point[] = [{ x: 0, y: r }, ...left.slice().reverse(), { x: 0, y: height - r }];
  const leftInsetAt = (y: number) => {
    for (let i = 0; i < leftEdge.length - 1; i += 1) {
      const a = leftEdge[i];
      const b = leftEdge[i + 1];
      if (y >= a.y && y <= b.y && b.y > a.y) return round(a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y));
    }
    return 0;
  };

  return { width, height, outline: d, leftInsetAt, tabs: tabShape };
}

/**
 * Largest lean (degrees) that keeps the tilted card within ~4pt of its
 * layout box, so tilting never clips content or touches a neighbour.
 */
export function maxPosterTilt(width: number, height: number) {
  const span = Math.max(width, height);
  if (!(span > 0)) return Infinity;
  return (Math.asin(Math.min(1, 8 / span)) * 180) / Math.PI;
}

/** Lightens (k > 0) or darkens (k < 0) a #RRGGBB colour; used for shading. */
export function shadeHex(hex: string, k: number) {
  const value = Number.parseInt(hex.slice(1, 7), 16);
  if (!Number.isFinite(value) || k === 0) return hex;
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const next = k >= 0 ? channel + (255 - channel) * k : channel * (1 + k);
    return Math.max(0, Math.min(255, Math.round(next)));
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
