import { colors } from '@pace-yourself/design-system';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { useTrailRandom } from '../TrailSeedProvider';

/** Stripe band width measured across the stripe (CSS `repeating-linear-gradient` 9px bands). */
const BAND = 9;
/** Horizontal period of one orange + white pair on a 45° tape. */
const PERIOD = BAND * Math.SQRT2 * 2;
/** Wide enough for any phone or tablet card; the container clips the rest. */
const DRAW_WIDTH = 1400;

type Props = {
  /** Stable key (alert type, id) so the tape keeps its phase for the session. */
  variationKey: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Closed-trail tape (rubalise): orange and white diagonal stripes. Decorative
 * only; the stripe phase is the sole session variation.
 */
export function TapeStrip({ variationKey, height = 6, style }: Props) {
  const random = useTrailRandom(`tape:${variationKey}`);
  const phase = -random.unit('phase') * PERIOD;
  const half = PERIOD / 2;
  let stripes = '';
  for (let x = phase - height; x < DRAW_WIDTH; x += PERIOD) {
    // "/" stripes: bottom-left to top-right, like the -45° CSS gradient.
    stripes += `M${x.toFixed(2)} ${height} L${(x + height).toFixed(2)} 0 L${(x + height + half).toFixed(2)} 0 L${(x + half).toFixed(2)} ${height} Z `;
  }

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[{ height, overflow: 'hidden' }, style]}
    >
      <Svg accessible={false} height={height} pointerEvents="none" width={DRAW_WIDTH}>
        <Rect fill={colors.trail.tapeWhite} height={height} width={DRAW_WIDTH} x={0} y={0} />
        <Path d={stripes} fill={colors.trail.tapeOrange} />
      </Svg>
    </View>
  );
}
