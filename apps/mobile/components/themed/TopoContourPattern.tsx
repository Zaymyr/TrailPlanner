import { colors } from '@pace-yourself/design-system';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Props = {
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
};

/** Decorative contour lines for identity surfaces. Never carries information. */
export function TopoContourPattern({
  color = colors.brand.forest,
  opacity = 0.06,
  style,
}: Props) {
  return (
    <View accessible={false} pointerEvents="none" style={[styles.container, style]}>
      <Svg height="100%" preserveAspectRatio="none" viewBox="0 0 320 160" width="100%">
        <Path
          d="M-28 132C18 82 55 150 102 105S184 45 222 88s72 45 126-2"
          fill="none"
          opacity={opacity}
          stroke={color}
          strokeWidth="2"
        />
        <Path
          d="M-18 151C31 105 63 165 115 121s82-57 121-20 70 38 112 7"
          fill="none"
          opacity={opacity * 0.78}
          stroke={color}
          strokeWidth="1.5"
        />
        <Path
          d="M55 0c31 29 15 57 47 75s69-4 88 24 7 49 31 72"
          fill="none"
          opacity={opacity * 0.62}
          stroke={color}
          strokeWidth="1.5"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});
