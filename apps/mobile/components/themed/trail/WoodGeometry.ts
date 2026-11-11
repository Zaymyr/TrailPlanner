import type { TrailRandom } from '../../../lib/trailSignature';

/**
 * Geometry of a painted wooden trail sign (TrailSignButton) or plank (active
 * TrailTabs label). Pure path builders: every irregularity comes from the
 * element's TrailRandom, so a sign keeps its look for the whole session.
 * Outline jitter only ever moves inwards so nothing is clipped by the canvas.
 */

export type WoodShape = 'arrow' | 'plank';

export type WoodSignPaths = {
  /** Tip length actually used (arrow only; 0 for planks). */
  tip: number;
  /** Outline of the face, shifted down by `oy` (thickness and shadow reuse it). */
  outline: (oy: number) => string;
  /** Routed groove parallel to the edge. */
  border: string;
  grainDark: string;
  grainLight: string;
  /** Knot rings ('' on calm planks). */
  knot: string;
  /** Faded paint patches near the edges and the tip ('' on calm planks). */
  wear: string;
  /** Bevel highlight along the top edge. */
  topLight: string;
};

type Options = {
  shape: WoodShape;
  width: number;
  height: number;
  radius: number;
  inset: number;
  /** Base tip length of an arrow sign. */
  tipWidth: number;
  random: TrailRandom;
  /** Amplitude of the tip jitter (± pt). */
  tipJitter: number;
  /** Global multiplier of shape jitter (mockup "variation"). */
  variation: number;
  /** 0..1, drives chipped shoulders. */
  wear: number;
};

const f = (value: number) => Math.round(value * 100) / 100;

const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f(cx - rx)} ${f(cy)} a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0 a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0 `;

function roundedPlank(width: number, height: number, radius: number, oy: number) {
  const b = oy + height;
  const r = Math.min(radius, height / 2);
  return `M${r} ${oy} H${f(width - r)} Q${f(width)} ${oy} ${f(width)} ${oy + r} V${b - r} Q${f(width)} ${b} ${f(width - r)} ${b} H${r} Q0 ${b} 0 ${b - r} V${oy + r} Q0 ${oy} ${r} ${oy} Z`;
}

function plankBorder(width: number, height: number, radius: number, insetToken: number) {
  const inset = Math.min(insetToken, height / 6);
  const r = Math.max(1, Math.min(radius, height / 2) - 2);
  const top = inset;
  const bottom = height - inset;
  const right = width - inset;
  return `M${inset + r} ${top} H${f(right - r)} Q${f(right)} ${top} ${f(right)} ${top + r} V${bottom - r} Q${f(right)} ${bottom} ${f(right - r)} ${bottom} H${inset + r} Q${inset} ${bottom} ${inset} ${bottom - r} V${top + r} Q${inset} ${top} ${inset + r} ${top} Z`;
}

export function buildWoodSign({
  shape, width, height, radius, inset, tipWidth, random, tipJitter, variation, wear,
}: Options): WoodSignPaths {
  const H = height;
  const R = Math.min(radius, H / 2);
  const j = (name: string, amplitude: number) => random.jitter(`wood:${name}`, amplitude * variation);
  const u = (name: string) => random.unit(`wood:${name}`);

  // Wood grain: long, gently waving fibres; about a third catch the light.
  const lines = shape === 'arrow' ? 7 : 4;
  let grainDark = '';
  let grainLight = '';
  for (let k = 0; k < lines; k += 1) {
    const y0 = 3 + (k + 0.5) * ((H - 6) / lines) + j(`grain${k}:y`, 1.5);
    const a = 0.6 + u(`grain${k}:a`) * 1.8;
    const segment = `M-4 ${f(y0)} C${f(width * 0.25)} ${f(y0 - a)} ${f(width * 0.55)} ${f(y0 + a)} ${f(width + 4)} ${f(y0 + j(`grain${k}:end`, 1.2))} `;
    if (u(`grain${k}:light`) < 0.3) grainLight += segment;
    else grainDark += segment;
  }

  if (shape === 'plank') {
    // Calm plank: grain and bevel only, regular outline, no knot or wear.
    return {
      tip: 0,
      outline: (oy) => roundedPlank(width, H, R, oy),
      border: plankBorder(width, H, radius, inset),
      grainDark,
      grainLight,
      knot: '',
      wear: '',
      topLight: `M${R} 1 H${f(width - R)}`,
    };
  }

  const tip = Math.max(8, tipWidth + j('tip', tipJitter));
  const tipY = H / 2 + j('tipY', 1.2);

  // Irregular long edges: points every 18–28pt, pulled slightly inwards.
  const xs: number[] = [];
  for (let x = R + 14, i = 0; x < width - tip - 6; i += 1) {
    xs.push(x);
    x += 18 + u(`edge${i}:step`) * 10;
  }
  const topJ = xs.map((_, i) => Math.abs(j(`edge${i}:top`, 0.6)));
  const botJ = xs.map((_, i) => Math.abs(j(`edge${i}:bottom`, 0.6)));
  const chipTop = random.chance('wood:chipTop', wear * 0.9);
  const chipBottom = random.chance('wood:chipBottom', wear * 0.6);
  const shoulder = width - tip;

  const outline = (oy: number) => {
    const b = oy + H;
    let d = `M${R} ${oy}`;
    xs.forEach((x, i) => { d += ` L${f(x)} ${f(oy + topJ[i])}`; });
    d += chipTop
      ? ` L${f(shoulder - 4)} ${oy} L${f(shoulder - 1)} ${f(oy + 2.2)} L${f(shoulder + 1.5)} ${f(oy + 1.4)}`
      : ` L${f(shoulder)} ${oy}`;
    d += ` L${f(width)} ${f(oy + tipY)}`;
    d += chipBottom
      ? ` L${f(shoulder + 1.5)} ${f(b - 1.2)} L${f(shoulder - 1.5)} ${f(b - 2)} L${f(shoulder - 4)} ${b}`
      : ` L${f(shoulder)} ${b}`;
    for (let i = xs.length - 1; i >= 0; i -= 1) d += ` L${f(xs[i])} ${f(b - botJ[i])}`;
    d += ` L${R} ${b} Q0 ${b} 0 ${b - R} V${oy + R} Q0 ${oy} ${R} ${oy} Z`;
    return d;
  };

  const groove = Math.min(inset, H / 6);
  const rr = Math.max(1, R - 2);
  const half = H / 2;
  // Horizontal shift that keeps the inner tip parallel to the outer one.
  const apexX = width - (groove * Math.hypot(tip, half)) / half;
  const shoulderX = apexX - (tip * (half - groove)) / half;
  const bottom = H - groove;
  const border = `M${groove + rr} ${groove} H${f(shoulderX)} L${f(apexX)} ${f(tipY)} L${f(shoulderX)} ${bottom} H${groove + rr} Q${groove} ${bottom} ${groove} ${bottom - rr} V${groove + rr} Q${groove} ${groove} ${groove + rr} ${groove} Z`;

  // A knot with rings, somewhere in the middle of the plank.
  const kx = width * (0.35 + u('knot:x') * 0.4);
  const ky = H * (0.3 + u('knot:y') * 0.4);
  const knot = ellipse(kx, ky, 4.5, 1.6) + ellipse(kx, ky, 8, 2.8) + ellipse(kx, ky, 12, 3.8);

  // Worn paint: faded patches hugging the long edges, plus one at the tip.
  let wearPath = '';
  const patches = 2 + Math.round(u('wear:count') * 3);
  for (let k = 0; k < patches; k += 1) {
    const edgeY = u(`wear${k}:side`) < 0.5 ? 2 + u(`wear${k}:y`) * 5 : H - 2 - u(`wear${k}:y`) * 5;
    wearPath += ellipse(R + u(`wear${k}:x`) * (shoulder - R), edgeY, 6 + u(`wear${k}:rx`) * 14, 1.2 + u(`wear${k}:ry`) * 2.2);
  }
  wearPath += ellipse(width - tip * 0.6, tipY, 4 + u('wear:tipx') * 4, 3 + u('wear:tipy') * 3);

  const topLight = `M${R} 1 ${xs.map((x, i) => `L${f(x)} ${f(1 + topJ[i])}`).join(' ')} L${f(shoulder)} 1`;

  return { tip, outline, border, grainDark, grainLight, knot, wear: wearPath, topLight };
}
