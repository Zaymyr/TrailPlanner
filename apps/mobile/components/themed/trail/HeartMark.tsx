import { colors } from '@pace-yourself/design-system';
import Svg, { Path } from 'react-native-svg';

const HEART_PATH = 'M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z';

type Props = {
  /** Filled when the race is a favourite, outlined otherwise. */
  filled: boolean;
  size?: number;
  color?: string;
};

/**
 * Favourite heart, always forest green (never red): the favourite is a
 * runner's bookmark, not an alert. The pressable wrapper owns the 44pt target
 * and the accessibility label/state.
 */
export function HeartMark({ filled, size = 22, color = colors.brand.forest }: Props) {
  return (
    <Svg accessible={false} height={size} pointerEvents="none" viewBox="0 0 24 24" width={size}>
      <Path
        d={HEART_PATH}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={filled ? 0 : 2}
      />
    </Svg>
  );
}
