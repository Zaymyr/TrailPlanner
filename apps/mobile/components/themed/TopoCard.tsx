import { colors, mobileComponents, spacing } from '@pace-yourself/design-system';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { TopoContourPattern } from './TopoContourPattern';
import { TrailBlaze, type TrailBlazeTone } from './TrailBlaze';
import { useTrailRandom } from './TrailSeedProvider';
import { PosterBackdrop } from './trail/PosterBackdrop';
import { buildPosterShape, maxPosterTilt } from './trail/PosterGeometry';
import { PosterPins, type PosterPin } from './trail/PosterPins';

export type TopoCardVariant = 'standard' | 'interactive' | 'signature' | 'featured';
export type TopoCardSurface = 'white' | 'cream' | 'sandLight' | 'brand' | 'info' | 'danger';

type Props = Omit<ViewProps, 'children' | 'style'> & {
  children: ReactNode;
  variant?: TopoCardVariant;
  /** Paper colour. Defaults to white, or to the green brand paper for `featured`. */
  surface?: TopoCardSurface;
  padded?: boolean;
  /** Tone of the leading-edge trail blaze on signature/featured cards. */
  blazeTone?: TrailBlazeTone;
  /**
   * Stable id (race id, section name) giving this poster its own lean,
   * crumple and pin position. Variant + surface + label/testID otherwise.
   */
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

const pinColorByVariant: Record<TopoCardVariant, string> = {
  standard: colors.trail.pinRed,
  interactive: colors.trail.pinAmber,
  signature: colors.trail.pinGreen,
  featured: colors.trail.pinRed,
};

const { padding: PADDING, borderRadius: RADIUS, blazeTop: BLAZE_TOP } = mobileComponents.topoCard;
const POSTER = mobileComponents.trailVariation.poster;
const FEATURED = mobileComponents.trailVariation.featured;
/** Tear-off strip of featured posters, and its gap below the content. */
const TAB_HEIGHT = spacing[6];
const TAB_GAP = spacing[3];
/** Pin centre from the top edge: inside the top padding, clear of content. */
const PIN_TOP = 9;
const FEATURED_PIN_INSET = 18;

function resolvedPaddingBottom(flat: ViewStyle, padded: boolean) {
  const value = flat.paddingBottom ?? flat.paddingVertical ?? flat.padding;
  if (typeof value === 'number') return value;
  return padded ? PADDING : 0;
}

/**
 * Card drawn as a poster pinned on the start-line board: a slightly
 * crumpled sheet with irregular edges, a light hand-pinned lean and a pin.
 * Standard = red pin, interactive = amber pin + painted arrow, signature =
 * green pin + trail blaze, featured = green poster with tear-off tabs.
 * Every irregularity is session-stable (TrailSeedProvider); colours, sizes,
 * spacing and text never vary.
 */
export function TopoCard({
  children,
  variant = 'standard',
  surface,
  padded = true,
  blazeTone,
  variationKey,
  onPress,
  onLayout,
  style,
  ...props
}: Props) {
  const resolvedSurface: TopoCardSurface = surface ?? (variant === 'featured' ? 'brand' : 'white');
  const resolvedBlazeTone: TrailBlazeTone = blazeTone
    ?? (resolvedSurface === 'danger' ? 'danger' : resolvedSurface === 'info' ? 'info' : 'brand');
  const fill = surfaceByVariant[resolvedSurface];
  const accented = variant === 'signature' || variant === 'featured';
  const flatStyle: ViewStyle = StyleSheet.flatten(style) ?? {};
  // The paper edge is drawn, not a View border: a caller's borderColor
  // (e.g. an "active" state) recolours the drawn edge instead.
  const edgeColor = typeof flatStyle.borderColor === 'string'
    ? flatStyle.borderColor
    : accented ? colors.brand.border : colors.border.subtle;

  const [size, setSize] = useState({ width: 0, height: 0 });
  const handleLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    const height = Math.round(event.nativeEvent.layout.height);
    setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    onLayout?.(event);
  };

  const random = useTrailRandom(
    `poster|${variationKey ?? `${variant}|${resolvedSurface}|${props.accessibilityLabel ?? props.testID ?? ''}`}`,
  );
  const leanLimit = maxPosterTilt(size.width, size.height);
  const lean = Math.max(-leanLimit, Math.min(leanLimit, random.jitter('tilt', POSTER.tilt)));

  const shape = useMemo(() => buildPosterShape({
    width: size.width,
    height: size.height,
    radius: RADIUS,
    edge: POSTER.edge,
    random,
    tabs: variant === 'featured'
      ? { height: TAB_HEIGHT, missingEvery: FEATURED.missingTabEvery, skew: FEATURED.skewedTab }
      : null,
  }), [size.width, size.height, random, variant]);

  const measured = size.width > 0 && size.height > 0;
  const pinY = PIN_TOP + random.jitter('pin:y', 1);
  const pins: PosterPin[] = !measured
    ? []
    : variant === 'featured'
      ? [
        { x: FEATURED_PIN_INSET + random.jitter('pin', POSTER.pin), y: pinY, color: pinColorByVariant.featured },
        { x: size.width - FEATURED_PIN_INSET + random.jitter('pin:right', POSTER.pin), y: pinY, color: pinColorByVariant.featured },
      ]
      : [{ x: size.width / 2 + random.jitter('pin', POSTER.pin), y: pinY, color: pinColorByVariant[variant] }];

  const tabSpacer = variant === 'featured'
    ? Math.max(0, TAB_HEIGHT + TAB_GAP - resolvedPaddingBottom(flatStyle, padded))
    : 0;

  const leanTransform = { rotate: `${lean}deg` };
  const cardStyle = [
    styles.base,
    // Until measured, a plain rounded sheet keeps the content on its surface.
    !measured && { backgroundColor: fill, borderRadius: RADIUS },
    padded && styles.padded,
    { transform: [leanTransform] },
    style,
  ];

  const content = (
    <>
      {measured ? (
        <PosterBackdrop
          edgeColor={edgeColor}
          fill={fill}
          shape={shape}
          tabInk={colors.brand.forest}
          texture={random.pick('texture', POSTER.textures)}
          textureOffset={{ x: random.unit('texture:x'), y: random.unit('texture:y') }}
        />
      ) : null}
      {variant === 'featured' ? <TopoContourPattern /> : null}
      {children}
      {tabSpacer > 0 ? (
        <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ height: tabSpacer }} />
      ) : null}
      {accented ? (
        <TrailBlaze
          size="sm"
          style={[styles.blaze, { left: measured ? shape.leftInsetAt(BLAZE_TOP + 4) : 0 }]}
          tone={resolvedBlazeTone}
        />
      ) : null}
      <PosterPins
        arrow={variant === 'interactive' && padded ? { color: colors.trail.pinAmber } : null}
        height={size.height}
        pins={pins}
        width={size.width}
      />
    </>
  );

  if (onPress || variant === 'interactive') {
    return (
      <Pressable
        {...props}
        accessibilityRole={onPress ? 'button' : props.accessibilityRole}
        onLayout={handleLayout}
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          pressed && onPress && [styles.pressed, { transform: [leanTransform, { scale: mobileComponents.motion.pressScale }] }],
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View {...props} onLayout={handleLayout} style={cardStyle}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'relative',
  },
  padded: {
    padding: PADDING,
  },
  pressed: {
    opacity: 0.88,
  },
  blaze: {
    position: 'absolute',
    top: BLAZE_TOP,
  },
});
