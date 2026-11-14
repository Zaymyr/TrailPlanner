import { colors, mobileComponents } from '@pace-yourself/design-system';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';

const { railWidth, dash, gap } = mobileComponents.timeline;

type RailProps = {
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Dotted vertical trail line linking timeline steps (ravitos, supporter
 * points, onboarding steps). It stretches to fill its parent: position it
 * absolutely or give it a height. Decorative only.
 */
export function TrailRail({ color = colors.border.strong, style }: RailProps) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.rail, style]}
    >
      <Svg height="100%" width={railWidth}>
        <Line
          stroke={color}
          strokeDasharray={[dash, gap]}
          strokeLinecap="round"
          strokeWidth={railWidth}
          x1={railWidth / 2}
          x2={railWidth / 2}
          y1={railWidth}
          y2="100%"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { width: railWidth, alignItems: 'center' },
});
