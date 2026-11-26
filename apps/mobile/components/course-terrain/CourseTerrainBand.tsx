import { useId, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, G, Line, Pattern, Rect } from 'react-native-svg';

import { buildCourseTerrainBandRects } from '../../lib/courseTerrain';
import type { CourseTerrainSegment } from '../../lib/courseTerrainShared';

/** Hatch stroke drawn over the `off_path` color: "no mapped path", never a real surface. */
const HATCH_COLOR = '#7A7668';
const HATCH_SPACING = 4;

type ShapesProps = {
  segments: CourseTerrainSegment[];
  fromKm: number;
  toKm: number;
  /** Left edge (px) of `fromKm`, same mapping as the curve above. */
  x: number;
  width: number;
  y: number;
  height: number;
};

/**
 * Terrain band drawn inside an existing `Svg` (the Livret coureur profile): one rect per segment,
 * `off_path` hatched. Pure SVG, no layout of its own.
 */
export function CourseTerrainBandShapes({ segments, fromKm, toKm, x, width, y, height }: ShapesProps) {
  const rawId = useId();
  const patternId = `terrain-hatch-${rawId.replace(/[^A-Za-z0-9_-]/g, '')}`;
  const rects = useMemo(
    () => buildCourseTerrainBandRects(segments, { fromKm, toKm, x, width }),
    [fromKm, segments, toKm, width, x],
  );
  if (rects.length === 0) return null;
  const hasHatch = rects.some((rect) => rect.hatched);
  return (
    <G>
      {hasHatch ? (
        <Defs>
          <Pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={HATCH_SPACING}
            height={HATCH_SPACING}
            patternTransform="rotate(45)"
          >
            <Line x1={0} y1={0} x2={0} y2={HATCH_SPACING} stroke={HATCH_COLOR} strokeWidth={1.4} />
          </Pattern>
        </Defs>
      ) : null}
      {rects.map((rect) => (
        <G key={rect.key}>
          <Rect x={rect.x} y={y} width={rect.width} height={height} fill={rect.color} />
          {rect.hatched ? <Rect x={rect.x} y={y} width={rect.width} height={height} fill={`url(#${patternId})`} /> : null}
        </G>
      ))}
    </G>
  );
}

/**
 * Standalone terrain band under a chart that does not host it (plan section mini profile):
 * `leftInset` / `rightInset` repeat the chart's own paddings so the band lines up with the curve.
 */
export function CourseTerrainBand({
  segments,
  fromKm,
  toKm,
  leftInset = 0,
  rightInset = 0,
  height = 6,
  accessibilityLabel,
}: {
  segments: CourseTerrainSegment[];
  fromKm: number;
  toKm: number;
  leftInset?: number;
  rightInset?: number;
  height?: number;
  accessibilityLabel?: string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };
  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      onLayout={onLayout}
      style={{ height }}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <CourseTerrainBandShapes
            segments={segments}
            fromKm={fromKm}
            toKm={toKm}
            x={leftInset}
            width={Math.max(0, width - leftInset - rightInset)}
            y={0}
            height={height}
          />
        </Svg>
      ) : null}
    </View>
  );
}
