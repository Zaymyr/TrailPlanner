import { colors } from '@pace-yourself/design-system';
import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { buildContourPaths, resampleProfile, type TrailProfilePoint } from '../../lib/trailSignature';

type Props = {
  color?: string;
  opacity?: number;
  /**
   * Real course profile. When usable, the contour lines are derived from it
   * so every race carries its own fingerprint; otherwise the brand pattern
   * is drawn. Callers must only pass a profile the viewer may already see.
   */
  profile?: readonly TrailProfilePoint[] | null;
  style?: StyleProp<ViewStyle>;
};

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 160;
const CONTOUR_LAYERS = 4;

const BRAND_PATHS = [
  { d: 'M-28 132C18 82 55 150 102 105S184 45 222 88s72 45 126-2', width: 2, weight: 1 },
  { d: 'M-18 151C31 105 63 165 115 121s82-57 121-20 70 38 112 7', width: 1.5, weight: 0.78 },
  { d: 'M55 0c31 29 15 57 47 75s69-4 88 24 7 49 31 72', width: 1.5, weight: 0.62 },
];

/** Decorative contour lines for identity surfaces. Never carries information. */
export function TopoContourPattern({
  color = colors.brand.forest,
  opacity = 0.06,
  profile,
  style,
}: Props) {
  const coursePaths = useMemo(() => {
    const values = resampleProfile(profile, 40);
    if (!values) return null;
    // The course ridge sits in the lower half so titles above stay clean.
    return buildContourPaths(values, { width: VIEW_WIDTH, height: VIEW_HEIGHT * 0.62, inset: 4 }, CONTOUR_LAYERS);
  }, [profile]);

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.container, style]}
    >
      <Svg height="100%" preserveAspectRatio="none" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} width="100%">
        {coursePaths
          ? coursePaths.map((d, index) => (
            <Path
              key={index}
              d={d}
              fill="none"
              opacity={opacity * (1.4 - index * 0.22)}
              stroke={color}
              strokeWidth={index === 0 ? 2 : 1.5}
              transform={`translate(0 ${VIEW_HEIGHT * 0.36})`}
            />
          ))
          : BRAND_PATHS.map((path) => (
            <Path
              key={path.d}
              d={path.d}
              fill="none"
              opacity={opacity * path.weight}
              stroke={color}
              strokeWidth={path.width}
            />
          ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});
