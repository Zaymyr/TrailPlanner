import { colors } from '@pace-yourself/design-system';
import { StyleSheet } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { POSTER_MARGIN } from './PosterBackdrop';
import { shadeHex } from './PosterGeometry';

export const POSTER_PIN_RADIUS = 5;

export type PosterPin = { x: number; y: number; color: string };

type Props = {
  width: number;
  height: number;
  pins: readonly PosterPin[];
  /** Painted amber arrow in the bottom-right padding (interactive posters). */
  arrow?: { color: string } | null;
};

function Pin({ x, y, color }: PosterPin) {
  const r = POSTER_PIN_RADIUS;
  return (
    <G>
      <Circle cx={x + 1} cy={y + 1.5} fill={colors.text.primary} opacity={0.22} r={r} />
      <Circle cx={x} cy={y} fill={shadeHex(color, -0.3)} r={r} />
      <Circle cx={x - 0.6} cy={y - 0.6} fill={color} r={r - 1.3} />
      <Circle cx={x - 1.8} cy={y - 1.8} fill={shadeHex(color, 0.45)} opacity={0.9} r={1.4} />
    </G>
  );
}

/**
 * Pins (and the interactive arrow) drawn above the card content. They sit in
 * the card's top/bottom padding so they never cover text. Decorative only.
 */
export function PosterPins({ width, height, pins, arrow }: Props) {
  if (width <= 0 || height <= 0) return null;
  const arrowX = width - 12 - 26;
  const arrowY = height - 4 - 10;
  return (
    <Svg
      accessible={false}
      height={height + POSTER_MARGIN * 2}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.svg}
      width={width + POSTER_MARGIN * 2}
    >
      <G transform={`translate(${POSTER_MARGIN} ${POSTER_MARGIN})`}>
        {arrow ? (
          // Brush-painted arrow, scaled from the 40x14 mockup glyph.
          <G transform={`translate(${arrowX} ${arrowY}) scale(0.65)`}>
            <Path d="M2 8 C12 5 22 9 32 7" fill="none" stroke={arrow.color} strokeLinecap="round" strokeWidth={3.4} />
            <Path d="M28 2 L37 7 L29 12" fill="none" stroke={arrow.color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.4} />
          </G>
        ) : null}
        {pins.map((pin) => <Pin key={`${pin.x}-${pin.y}`} {...pin} />)}
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  svg: { position: 'absolute', left: -POSTER_MARGIN, top: -POSTER_MARGIN },
});
