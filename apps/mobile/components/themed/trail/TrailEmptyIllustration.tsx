import { colors } from '@pace-yourself/design-system';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Ellipse, Path, Text as SvgText } from 'react-native-svg';

/** Post of the start sign: weathered wood, decorative only. */
const SIGN_POST = colors.trail.signPost;

type Props = {
  /** Text painted on the start sign (already localised, e.g. "Départ"). */
  signLabel: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Empty state picture: a blank dotted trail, a small cairn and a start sign
 * waiting for the first plan. Purely decorative; the empty state title says it.
 */
export function TrailEmptyIllustration({ signLabel, style }: Props) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[{ width: 220, height: 80 }, style]}
    >
      <Svg accessible={false} height={80} pointerEvents="none" viewBox="0 0 220 80" width={220}>
        <Path
          d="M8 72 C50 70 60 52 96 54 S150 40 168 30"
          fill="none"
          stroke={colors.border.strong}
          strokeDasharray={[5, 5]}
          strokeLinecap="round"
          strokeWidth={2.5}
        />
        <Ellipse cx={34} cy={70} fill={colors.border.strong} rx={10} ry={4} />
        <Ellipse cx={34} cy={63} fill={colors.trail.stone} rx={7} ry={3.5} />
        <Ellipse cx={34} cy={57} fill={colors.text.tertiary} rx={4.5} ry={2.8} />
        <Path d="M176 76 V20" stroke={SIGN_POST} strokeLinecap="round" strokeWidth={3} />
        <Path d="M160 18 H202 L210 25 L202 32 H160 Z" fill={colors.brand.forest} />
        <Path d="M166 22 H200" stroke={colors.brand.forestLight} strokeWidth={1} />
        <SvgText
          fill={colors.text.inverse}
          fontFamily="JetBrainsMono_700Bold"
          fontSize={8}
          fontWeight="700"
          letterSpacing={1}
          textAnchor="middle"
          x={181}
          y={28.5}
        >
          {signLabel.toLocaleUpperCase()}
        </SvgText>
      </Svg>
    </View>
  );
}
