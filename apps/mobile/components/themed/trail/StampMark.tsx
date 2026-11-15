import { colors, mobileComponents } from '@pace-yourself/design-system';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTrailRandom } from '../TrailSeedProvider';

const SIZE = 28;

type Props = {
  checked: boolean;
  /** Stable item key: each item keeps its own stamp angle for the session. */
  variationKey: string;
};

/**
 * Checklist box drawn like a race-control rubber stamp. Checked: a slightly
 * rotated stamp (dashed inner ring + tick); unchecked: an empty dashed circle.
 * The row owns the checkbox role and state.
 */
export function StampMark({ checked, variationKey }: Props) {
  const random = useTrailRandom(`stamp:${variationKey}`, { neutral: !checked });
  const rotation = random.between('stamp', mobileComponents.trailVariation.stamp);

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: SIZE, height: SIZE, transform: [{ rotate: `${rotation}deg` }] }}
    >
      <Svg accessible={false} height={SIZE} pointerEvents="none" viewBox="0 0 28 28" width={SIZE}>
        {checked ? (
          <>
            <Circle cx={14} cy={14} fill={colors.brand.surface} r={13} stroke={colors.brand.forest} strokeWidth={2} />
            <Circle cx={14} cy={14} fill="none" r={9.5} stroke={colors.brand.forest} strokeDasharray={[2, 1.5]} strokeWidth={1} />
            <Path
              d="M9 14.5l3.4 3.2L19 10.5"
              fill="none"
              stroke={colors.brand.forest}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.4}
            />
          </>
        ) : (
          <Circle cx={14} cy={14} fill={colors.surface.white} r={13} stroke={colors.text.tertiary} strokeDasharray={[4, 3]} strokeWidth={2} />
        )}
      </Svg>
    </View>
  );
}
