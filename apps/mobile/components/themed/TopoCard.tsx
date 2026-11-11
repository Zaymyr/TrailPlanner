import { colors, mobileComponents, shadows } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { SIGNATURE_RIDGE, buildRidgeAreaPath, buildRidgePath } from '../../lib/trailSignature';
import { TrailBlaze, type TrailBlazeTone } from './TrailBlaze';

export type TopoCardVariant = 'standard' | 'interactive' | 'signature' | 'featured';
export type TopoCardSurface = 'white' | 'cream' | 'sandLight' | 'brand' | 'info' | 'danger';

type Props = Omit<ViewProps, 'children' | 'style'> & {
  children: ReactNode;
  variant?: TopoCardVariant;
  /** Card colour. Defaults to white, or to the green brand surface for `featured`. */
  surface?: TopoCardSurface;
  padded?: boolean;
  /** Tone of the leading-edge trail blaze on interactive/signature/featured cards. */
  blazeTone?: TrailBlazeTone;
  /** @deprecated Cards no longer vary per item; accepted for compatibility and ignored. */
  variationKey?: string;
  onPress?: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
};

const surfaceByVariant: Record<TopoCardSurface, string> = {
  white: colors.surface.white,
  cream: colors.surface.cream,
  sandLight: colors.surface.sandLight,
  brand: colors.brand.surface,
  info: colors.semantic.infoSurface,
  danger: colors.semantic.dangerSurface,
};

const { padding: PADDING, borderRadius: RADIUS, blazeTop: BLAZE_TOP, edgeBlaze: EDGE_BLAZE } = mobileComponents.topoCard;
const BORDER_WIDTH = 1;

/** Contour corner: three concentric ellipses peeking from the top-right corner. */
const CONTOUR = { width: 130, height: 90, offset: -10, opacity: 0.08 } as const;
const CONTOUR_RINGS = [
  { rx: 70, ry: 40 },
  { rx: 50, ry: 28 },
  { rx: 30, ry: 16 },
] as const;

/** Featured watermark: the signature course ridge in the bottom-right corner. */
const RIDGE = { width: 200, height: 70, fillOpacity: 0.05, strokeOpacity: 0.14 } as const;
const RIDGE_FRAME = { width: RIDGE.width, height: RIDGE.height, inset: 4 };
const RIDGE_AREA = buildRidgeAreaPath(SIGNATURE_RIDGE, RIDGE_FRAME);
const RIDGE_LINE = buildRidgePath(SIGNATURE_RIDGE, RIDGE_FRAME);

function ContourCorner() {
  return (
    <Svg height={CONTOUR.height} style={styles.contour} viewBox={`0 0 ${CONTOUR.width} ${CONTOUR.height}`} width={CONTOUR.width}>
      {CONTOUR_RINGS.map((ring) => (
        <Ellipse
          key={ring.rx}
          cx={100}
          cy={20}
          fill="none"
          rx={ring.rx}
          ry={ring.ry}
          stroke={colors.brand.forest}
          strokeOpacity={CONTOUR.opacity}
          strokeWidth={1}
        />
      ))}
    </Svg>
  );
}

function RidgeWatermark() {
  return (
    <Svg height={RIDGE.height} style={styles.ridge} width={RIDGE.width}>
      <Path d={RIDGE_AREA} fill={colors.brand.forest} fillOpacity={RIDGE.fillOpacity} />
      <Path
        d={RIDGE_LINE}
        fill="none"
        stroke={colors.brand.forest}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={RIDGE.strokeOpacity}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

/**
 * "Fiche topo" card: a clean sheet with a thin border and no texture. Its
 * personality comes from small, fixed details only:
 * - standard: faint contour lines in the top-right corner;
 * - interactive / signature: the same contour corner plus the tricolour trail
 *   blaze flush with the left edge (interactive keeps the press feedback);
 * - featured: brand surface, blaze, and the course ridge as a faint watermark.
 * Decorations sit in a clipped, non-interactive layer behind the content, so
 * the card itself never clips its children or its shadow.
 */
export function TopoCard({
  children,
  variant = 'standard',
  surface,
  padded = true,
  blazeTone,
  variationKey: _variationKey,
  onPress,
  style,
  ...props
}: Props) {
  const resolvedSurface: TopoCardSurface = surface ?? (variant === 'featured' ? 'brand' : 'white');
  const resolvedBlazeTone: TrailBlazeTone = blazeTone
    ?? (resolvedSurface === 'danger' ? 'danger' : resolvedSurface === 'info' ? 'info' : 'brand');
  const hasBlaze = variant !== 'standard';
  const featured = variant === 'featured';
  const flatStyle: ViewStyle = StyleSheet.flatten(style) ?? {};
  const outerRadius = typeof flatStyle.borderRadius === 'number' ? flatStyle.borderRadius : RADIUS;
  const borderWidth = typeof flatStyle.borderWidth === 'number' ? flatStyle.borderWidth : BORDER_WIDTH;

  // A caller's borderColor / backgroundColor (e.g. an "active" state or a
  // RaceBook brand theme) wins because `style` comes last.
  const cardStyle = [
    styles.base,
    {
      backgroundColor: surfaceByVariant[resolvedSurface],
      borderColor: featured && resolvedSurface === 'brand' ? colors.brand.border : colors.border.subtle,
    },
    padded && styles.padded,
    style,
  ];

  const content = (
    <>
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[styles.decor, { borderRadius: Math.max(0, outerRadius - borderWidth) }]}
      >
        {featured ? <RidgeWatermark /> : <ContourCorner />}
      </View>
      {children}
      {hasBlaze ? <TrailBlaze geometry={EDGE_BLAZE} style={styles.blaze} tone={resolvedBlazeTone} /> : null}
    </>
  );

  if (onPress || variant === 'interactive') {
    return (
      <Pressable
        {...props}
        accessibilityRole={onPress ? 'button' : props.accessibilityRole}
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && onPress && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View {...props} style={cardStyle}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'relative',
    borderRadius: RADIUS,
    borderWidth: BORDER_WIDTH,
    boxShadow: shadows.sm,
  } as ViewStyle,
  padded: {
    padding: PADDING,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: mobileComponents.motion.pressScale }],
  },
  decor: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  contour: {
    position: 'absolute',
    right: CONTOUR.offset,
    top: CONTOUR.offset,
  },
  ridge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  blaze: {
    position: 'absolute',
    left: 0,
    top: BLAZE_TOP,
  },
});
