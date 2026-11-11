import { colors } from '@pace-yourself/design-system';
import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { ClipPath, Defs, G, Image as SvgImage, Line, Path, Rect } from 'react-native-svg';

import type { PosterShape } from './PosterGeometry';

/**
 * Baked crumpled-paper lighting (see scripts/generate-paper-textures.py):
 * black pixels shade the creases, white ones catch the light, flat paper is
 * transparent so the surface colour shows through untouched.
 */
export const POSTER_TEXTURES = [
  require('../../../assets/textures/paper-0.png'),
  require('../../../assets/textures/paper-1.png'),
  require('../../../assets/textures/paper-2.png'),
  require('../../../assets/textures/paper-3.png'),
] as const;

/**
 * Texture strength. Peak crease shade = 10% black x 0.65 = 6.5%, which keeps
 * text.secondary >= 4.5:1 on every TopoCard surface (worst: brand, 4.6:1).
 */
const TEXTURE_OPACITY = 0.65;

/** Room around the card for the cast shadow and pins. */
export const POSTER_MARGIN = 8;

/** Soft drop shadow approximated by stacked offset outlines (no blur filter on Android). */
const SHADOW_LAYERS = [
  { dx: 0.5, dy: 1, opacity: 0.05 },
  { dx: 1.5, dy: 2.5, opacity: 0.04 },
  { dx: 2.5, dy: 4, opacity: 0.03 },
] as const;

type Props = {
  shape: PosterShape;
  fill: string;
  edgeColor: string;
  /** Index into POSTER_TEXTURES. */
  texture: number;
  /** 0..1 position of the texture crop (keeps each card's crumple distinct). */
  textureOffset: { x: number; y: number };
  /** Ink of the printed marks on the tear-off tabs. */
  tabInk: string;
};

/**
 * Paper of a TopoCard: cast shadow, irregular sheet, crumple texture clipped
 * to the sheet, hairline edge and, on featured posters, the tear-off strip.
 * Decorative only; sits behind the card content.
 */
export function PosterBackdrop({ shape, fill, edgeColor, texture, textureOffset, tabInk }: Props) {
  const clipId = `poster-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { width, height, outline, tabs } = shape;
  if (width <= 0 || height <= 0) return null;

  // Square texture larger than the card; the offset picks which crop shows.
  const size = Math.max(width, height) * 1.25;
  const imageX = -(size - width) * textureOffset.x;
  const imageY = -(size - height) * textureOffset.y;
  const source = POSTER_TEXTURES[texture % POSTER_TEXTURES.length];

  const tabWidth = tabs ? width / tabs.count : 0;
  const stripTop = tabs ? height - tabs.height : 0;
  const tabMarks = (x0: number) => {
    const cx = x0 + tabWidth / 2;
    const half = Math.min(14, tabWidth * 0.28);
    const y = stripTop + tabs!.height / 2;
    return (
      <>
        <Line stroke={tabInk} strokeLinecap="round" strokeOpacity={0.4} strokeWidth={2} x1={cx - half} x2={cx + half} y1={y - 2.5} y2={y - 2.5} />
        <Line stroke={tabInk} strokeLinecap="round" strokeOpacity={0.25} strokeWidth={1.5} x1={cx - half * 0.6} x2={cx + half * 0.6} y1={y + 3} y2={y + 3} />
      </>
    );
  };

  return (
    <Svg
      accessible={false}
      height={height + POSTER_MARGIN * 2}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.svg}
      width={width + POSTER_MARGIN * 2}
    >
      <Defs>
        <ClipPath id={clipId}>
          <Path d={outline} />
        </ClipPath>
      </Defs>
      <G transform={`translate(${POSTER_MARGIN} ${POSTER_MARGIN})`}>
        {SHADOW_LAYERS.map((layer) => (
          <Path
            d={outline}
            fill={colors.text.primary}
            key={`${layer.dx}-${layer.dy}`}
            opacity={layer.opacity}
            transform={`translate(${layer.dx} ${layer.dy})`}
          />
        ))}
        <Path d={outline} fill={fill} />
        <G clipPath={`url(#${clipId})`}>
          <SvgImage
            height={size}
            href={source}
            opacity={TEXTURE_OPACITY}
            preserveAspectRatio="xMidYMid slice"
            width={size}
            x={imageX}
            y={imageY}
          />
          {tabs ? (
            <>
              <Line stroke={edgeColor} strokeDasharray="4 3" strokeWidth={1.5} x1={0} x2={width} y1={stripTop} y2={stripTop} />
              {Array.from({ length: tabs.count - 1 }, (_, i) => (
                <Line
                  key={`sep-${i}`}
                  stroke={edgeColor}
                  strokeDasharray="3 3"
                  strokeOpacity={0.8}
                  strokeWidth={1}
                  x1={(i + 1) * tabWidth}
                  x2={(i + 1) * tabWidth}
                  y1={stripTop}
                  y2={height}
                />
              ))}
              {Array.from({ length: tabs.count }, (_, i) => (
                i === tabs.missing || i === tabs.skewed ? null : <G key={`tab-${i}`}>{tabMarks(i * tabWidth)}</G>
              ))}
            </>
          ) : null}
        </G>
        <Path d={outline} fill="none" stroke={edgeColor} strokeLinejoin="round" strokeOpacity={0.7} strokeWidth={1} />
        {tabs && tabs.skewed != null ? (
          // A tab half torn: hangs from its hinge, a few degrees askew.
          <G transform={`rotate(${tabs.skewAngle} ${tabs.skewed * tabWidth + tabWidth / 2} ${stripTop})`}>
            <Rect fill={colors.text.primary} height={tabs.height - 1} opacity={0.06} width={tabWidth - 1.5} x={tabs.skewed * tabWidth + 1.5} y={stripTop + 2} />
            <Rect fill={fill} height={tabs.height - 1} stroke={edgeColor} strokeOpacity={0.7} strokeWidth={1} width={tabWidth - 1.5} x={tabs.skewed * tabWidth + 0.75} y={stripTop + 0.5} />
            {tabMarks(tabs.skewed * tabWidth)}
          </G>
        ) : null}
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  svg: { position: 'absolute', left: -POSTER_MARGIN, top: -POSTER_MARGIN },
});
