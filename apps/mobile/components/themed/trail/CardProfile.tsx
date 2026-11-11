import { colors } from '@pace-yourself/design-system';
import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import type { CatalogProfileLayer } from '../../../lib/catalogCourseProfiles';
import {
  SIGNATURE_RIDGE,
  buildRidgeAreaPath,
  buildRidgePath,
  resampleProfile,
  type TrailProfilePoint,
} from '../../../lib/trailSignature';

/** Samples drawn for card profiles: enough for a recognisable skyline, cheap to render in lists. */
const CARD_PROFILE_SAMPLES = 24;
/** Keeps the summit and the lowest point off the strip edges (fraction of the height). */
const CARD_PROFILE_TOP = 0.88;
const CARD_PROFILE_BOTTOM = 0.12;

function useCardProfileValues(profile: readonly TrailProfilePoint[] | null | undefined, fallback: boolean) {
  return useMemo(() => {
    const values = resampleProfile(profile, CARD_PROFILE_SAMPLES) ?? (fallback ? SIGNATURE_RIDGE : null);
    if (!values) return null;
    return scaleToStrip(values);
  }, [profile, fallback]);
}

/**
 * Line colours of overlaid formats, longest first: forest, then muted map
 * inks (blue-grey water line, sign-post brown, ochre, stone). Sober and
 * distinguishable, never the accent oranges. Token candidates.
 */
export const CARD_PROFILE_LAYER_COLORS: readonly string[] = [
  colors.brand.forest,
  colors.brand.secondary,
  colors.trail.signPost,
  colors.trail.ticketInk,
  colors.trail.stone,
];

function scaleToStrip(values: readonly number[]) {
  return values.map((value) => CARD_PROFILE_BOTTOM + value * (CARD_PROFILE_TOP - CARD_PROFILE_BOTTOM));
}

type StripProps = {
  /** Real course profile; the brand ridge is drawn when absent or unusable. */
  profile?: readonly TrailProfilePoint[] | null;
  /**
   * Several formats overlaid on shared axes (see `buildCatalogProfileLayers`).
   * Takes precedence over `profile` when it holds at least one layer.
   */
  layers?: readonly CatalogProfileLayer[] | null;
  height?: number;
  fillColor?: string;
  lineColor?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Elevation strip laid at the foot of a race card, edge to edge: light fill
 * with a forest ridge line. Identity only, never exact figures.
 */
export function CardProfileStrip({
  profile,
  layers,
  height = 34,
  fillColor = colors.brand.surface,
  lineColor = colors.brand.forest,
  style,
}: StripProps) {
  const hasLayers = Boolean(layers && layers.length > 0);
  const values = useCardProfileValues(hasLayers ? null : profile, !hasLayers);
  const scaledLayers = useMemo(
    () => (hasLayers && layers ? layers.map((layer) => ({ ...layer, values: scaleToStrip(layer.values) })) : null),
    [hasLayers, layers],
  );
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((current) => (current === next ? current : next));
  };
  const frame = { width, height };

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      onLayout={onLayout}
      pointerEvents="none"
      style={[{ height, alignSelf: 'stretch' }, style]}
    >
      {width > 0 && scaledLayers ? (
        <Svg accessible={false} height={height} pointerEvents="none" width={width}>
          {scaledLayers.map((layer) => {
            const layerFrame = { width: Math.max(1, width * layer.widthRatio), height };
            const color = CARD_PROFILE_LAYER_COLORS[layer.rank % CARD_PROFILE_LAYER_COLORS.length];
            return (
              <G key={layer.key}>
                {/* Only the longest format gets a very light fill; others stay lines. */}
                {layer.rank === 0 ? <Path d={buildRidgeAreaPath(layer.values, layerFrame)} fill={fillColor} opacity={0.7} /> : null}
                <Path
                  d={buildRidgePath(layer.values, layerFrame)}
                  fill="none"
                  stroke={color}
                  strokeLinejoin="round"
                  strokeOpacity={layer.rank === 0 ? 0.85 : 0.7}
                  strokeWidth={layer.rank === 0 ? 1.4 : 1.1}
                />
              </G>
            );
          })}
        </Svg>
      ) : width > 0 && values ? (
        <Svg accessible={false} height={height} pointerEvents="none" width={width}>
          <Path d={buildRidgeAreaPath(values, frame)} fill={fillColor} />
          <Path
            d={buildRidgePath(values, frame)}
            fill="none"
            stroke={lineColor}
            strokeLinejoin="round"
            strokeWidth={1.5}
          />
        </Svg>
      ) : null}
    </View>
  );
}

type MiniProps = {
  /** Only a real stored profile draws; nothing is rendered otherwise. */
  profile?: readonly TrailProfilePoint[] | null;
  /** `draft` draws a dashed, muted line for plans that are not ready yet. */
  variant?: 'ready' | 'draft';
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Compact course line for list rows (72×26 by default). */
export function CardMiniProfile({ profile, variant = 'ready', width = 72, height = 26, style }: MiniProps) {
  const values = useCardProfileValues(profile, false);
  if (!values) return null;
  const draft = variant === 'draft';
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[{ width, height }, style]}
    >
      <Svg accessible={false} height={height} pointerEvents="none" width={width}>
        <Path
          d={buildRidgePath(values, { width, height, inset: 1 })}
          fill="none"
          stroke={draft ? colors.text.tertiary : colors.brand.forest}
          strokeDasharray={draft ? [3, 2] : undefined}
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
      </Svg>
    </View>
  );
}
