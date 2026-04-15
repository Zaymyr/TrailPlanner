import { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
  type NativeMethods,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

import { Colors } from '../../constants/colors';
import { SpotlightRect, TutorialStep, type SpotlightPlacement } from '../../lib/helpTutorial';

export type TutorialMeasurableTarget = {
  measureLayout: (
    relativeToNativeComponentRef: number | NativeMethods,
    onSuccess: (x: number, y: number, width: number, height: number) => void,
    onFail?: () => void,
  ) => void;
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
} | null;

type SpotlightTutorialProps<TTargetKey extends string = string> = {
  activeStepIndex: number;
  closeLabel: string;
  doneLabel: string;
  loadingLabel: string;
  nextLabel: string;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  previousLabel: string;
  steps: TutorialStep<TTargetKey>[];
  targetRect: SpotlightRect | null;
  visible: boolean;
  viewportHeight: number;
  viewportWidth: number;
};

type TutorialTargetProps<TTargetKey extends string = string> = {
  children: React.ReactNode;
  onMeasure: (targetKey: TTargetKey, layout: LayoutRectangle) => void;
  onRegisterRef?: (targetKey: TTargetKey, ref: TutorialMeasurableTarget) => void;
  style?: StyleProp<ViewStyle>;
  targetKey: TTargetKey;
};

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const CARD_WIDTH = 320;
const CARD_GAP = 16;
const CARD_SIDE_MARGIN = 16;
const DEFAULT_HIGHLIGHT_PADDING = 10;
const DEFAULT_HIGHLIGHT_RADIUS = 18;
const CARD_MAX_HEIGHT = 320;
const CARD_MIN_VISIBLE_HEIGHT = 168;
const MIN_BOTTOM_SPACE = 220;
const SCRIM_COLOR = 'rgba(15, 23, 42, 0.58)';
const MASK_ID = 'tutorialSpotlightMask';

export function TutorialTarget<TTargetKey extends string>({
  children,
  onMeasure,
  onRegisterRef,
  style,
  targetKey,
}: TutorialTargetProps<TTargetKey>) {
  const targetRef = useRef<View>(null);

  useEffect(() => {
    onRegisterRef?.(targetKey, targetRef.current);
  }, [onRegisterRef, targetKey]);

  const handleLayout = (event: LayoutChangeEvent) => {
    onMeasure(targetKey, event.nativeEvent.layout);
    onRegisterRef?.(targetKey, targetRef.current);
  };

  return (
    <View ref={targetRef} collapsable={false} onLayout={handleLayout} style={style}>
      {children}
    </View>
  );
}

export function SpotlightTutorial<TTargetKey extends string = string>({
  activeStepIndex,
  closeLabel,
  doneLabel,
  loadingLabel,
  nextLabel,
  onClose,
  onNext,
  onPrevious,
  previousLabel,
  steps,
  targetRect,
  visible,
  viewportHeight,
  viewportWidth,
}: SpotlightTutorialProps<TTargetKey>) {
  const step = steps[activeStepIndex] ?? null;
  const isLastStep = activeStepIndex >= steps.length - 1;
  const hasPrevious = activeStepIndex > 0;
  const holeX = useRef(new Animated.Value(0)).current;
  const holeY = useRef(new Animated.Value(0)).current;
  const holeWidth = useRef(new Animated.Value(0)).current;
  const holeHeight = useRef(new Animated.Value(0)).current;
  const holeRadius = useRef(new Animated.Value(DEFAULT_HIGHLIGHT_RADIUS)).current;

  useEffect(() => {
    if (!visible) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });

    return () => subscription.remove();
  }, [onClose, visible]);

  const highlightPadding = step?.highlightPadding ?? DEFAULT_HIGHLIGHT_PADDING;
  const highlightRadiusValue = step?.highlightRadius ?? DEFAULT_HIGHLIGHT_RADIUS;

  const highlightRect = useMemo(() => {
    if (!targetRect || viewportWidth <= 0 || viewportHeight <= 0) {
      return null;
    }

    return {
      x: Math.max(8, targetRect.x - highlightPadding),
      y: Math.max(8, targetRect.y - highlightPadding),
      width: Math.min(targetRect.width + highlightPadding * 2, viewportWidth - 16),
      height: targetRect.height + highlightPadding * 2,
    };
  }, [highlightPadding, targetRect, viewportHeight, viewportWidth]);

  useEffect(() => {
    if (!visible || !highlightRect) return;

    Animated.parallel([
      Animated.timing(holeX, {
        toValue: highlightRect.x,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(holeY, {
        toValue: highlightRect.y,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(holeWidth, {
        toValue: highlightRect.width,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(holeHeight, {
        toValue: highlightRect.height,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(holeRadius, {
        toValue: highlightRadiusValue,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start();
  }, [
    highlightRadiusValue,
    highlightRect,
    holeHeight,
    holeRadius,
    holeWidth,
    holeX,
    holeY,
    visible,
  ]);

  const cardStyle = useMemo<StyleProp<ViewStyle>>(() => {
    if (!step) {
      return [styles.card];
    }

    if (!highlightRect) {
      const width = Math.min(CARD_WIDTH, viewportWidth - CARD_SIDE_MARGIN * 2);
      const maxHeight = Math.min(CARD_MAX_HEIGHT, viewportHeight - CARD_SIDE_MARGIN * 2);
      const estimatedCardHeight = Math.min(maxHeight, 260);
      const top = Math.max(
        CARD_SIDE_MARGIN,
        Math.round((viewportHeight - estimatedCardHeight) / 2),
      );

      return [
        styles.card,
        {
          left: Math.max(CARD_SIDE_MARGIN, Math.round((viewportWidth - width) / 2)),
          maxHeight,
          top,
          width,
        },
      ];
    }

    const width = Math.min(CARD_WIDTH, viewportWidth - CARD_SIDE_MARGIN * 2);
    const maxCardHeight = Math.min(CARD_MAX_HEIGHT, viewportHeight - CARD_SIDE_MARGIN * 2);
    const targetCenter = highlightRect.x + highlightRect.width / 2;
    const left = Math.min(
      Math.max(CARD_SIDE_MARGIN, targetCenter - width / 2),
      Math.max(CARD_SIDE_MARGIN, viewportWidth - width - CARD_SIDE_MARGIN),
    );

    const topSpace = Math.max(0, highlightRect.y - CARD_GAP - CARD_SIDE_MARGIN);
    const bottomSpace = Math.max(
      0,
      viewportHeight - (highlightRect.y + highlightRect.height) - CARD_GAP - CARD_SIDE_MARGIN,
    );
    const maxAvailableSpace = Math.max(topSpace, bottomSpace);
    if (maxAvailableSpace < 140) {
      const estimatedCardHeight = Math.min(maxCardHeight, 260);
      const fallbackTop = Math.max(
        CARD_SIDE_MARGIN,
        Math.round((viewportHeight - estimatedCardHeight) / 2),
      );

      return [
        styles.card,
        {
          maxHeight: maxCardHeight,
          left: Math.max(CARD_SIDE_MARGIN, Math.round((viewportWidth - width) / 2)),
          top: fallbackTop,
          width,
        },
      ];
    }

    const requestedPlacement = step.placement ?? 'auto';
    let placement = resolvePlacement(requestedPlacement, topSpace, bottomSpace);

    const preferredSpace = placement === 'top' ? topSpace : bottomSpace;
    const alternateSpace = placement === 'top' ? bottomSpace : topSpace;
    if (preferredSpace < CARD_MIN_VISIBLE_HEIGHT && alternateSpace > preferredSpace) {
      placement = placement === 'top' ? 'bottom' : 'top';
    }

    const availableHeight = placement === 'top' ? topSpace : bottomSpace;
    const maxHeight = Math.min(maxCardHeight, availableHeight);
    const top =
      placement === 'top'
        ? Math.max(CARD_SIDE_MARGIN, highlightRect.y - CARD_GAP - maxHeight)
        : Math.min(
            highlightRect.y + highlightRect.height + CARD_GAP,
            Math.max(CARD_SIDE_MARGIN, viewportHeight - maxHeight - CARD_SIDE_MARGIN),
          );

    return [
      styles.card,
      { left, maxHeight, top, width },
    ];
  }, [highlightRect, step, viewportHeight, viewportWidth]);

  if (!visible || !step || viewportWidth <= 0 || viewportHeight <= 0) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Svg height={viewportHeight} pointerEvents="none" style={styles.svgOverlay} width={viewportWidth}>
        <Defs>
          <Mask id={MASK_ID}>
            <Rect fill="#ffffff" height={viewportHeight} width={viewportWidth} x={0} y={0} />
            {highlightRect ? (
              <AnimatedRect
                fill="#000000"
                height={holeHeight}
                rx={holeRadius}
                ry={holeRadius}
                width={holeWidth}
                x={holeX}
                y={holeY}
              />
            ) : null}
          </Mask>
        </Defs>

        <Rect
          fill={SCRIM_COLOR}
          height={viewportHeight}
          mask={`url(#${MASK_ID})`}
          width={viewportWidth}
          x={0}
          y={0}
        />

        {highlightRect ? (
          <>
            <AnimatedRect
              fill="transparent"
              height={holeHeight}
              rx={holeRadius}
              ry={holeRadius}
              stroke="rgba(255,255,255,0.92)"
              strokeWidth={2}
              width={holeWidth}
              x={holeX}
              y={holeY}
            />
            <AnimatedRect
              fill="transparent"
              height={holeHeight}
              rx={holeRadius}
              ry={holeRadius}
              stroke="rgba(255,255,255,0.28)"
              strokeWidth={12}
              width={holeWidth}
              x={holeX}
              y={holeY}
            />
          </>
        ) : null}
      </Svg>

      <Pressable onPress={onClose} style={styles.dismissLayer} />

      <View style={cardStyle}>
        <View style={styles.cardHeader}>
          <Text style={styles.progressText}>
            {activeStepIndex + 1} / {steps.length}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{closeLabel}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          bounces={false}
          contentContainerStyle={styles.cardContent}
          showsVerticalScrollIndicator={false}
          style={styles.cardScroll}
        >
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>

          {!highlightRect ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={Colors.brandPrimary} />
              <Text style={styles.loadingText}>{loadingLabel}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            disabled={!hasPrevious}
            onPress={onPrevious}
            style={[styles.secondaryButton, !hasPrevious && styles.secondaryButtonDisabled]}
          >
            <Text style={[styles.secondaryButtonText, !hasPrevious && styles.secondaryButtonTextDisabled]}>
              {previousLabel}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onNext} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{isLastStep ? doneLabel : nextLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function resolvePlacement(
  placement: SpotlightPlacement,
  topSpace: number,
  bottomSpace: number,
): Exclude<SpotlightPlacement, 'auto'> {
  if (placement === 'top' || placement === 'bottom') {
    return placement;
  }

  if (bottomSpace >= MIN_BOTTOM_SPACE || bottomSpace >= topSpace) {
    return 'bottom';
  }

  return 'top';
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  svgOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  dismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  card: {
    position: 'absolute',
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    overflow: 'hidden',
    zIndex: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressText: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeButtonText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  body: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  cardScroll: {
    flexGrow: 0,
    marginTop: 12,
  },
  cardContent: {
    paddingBottom: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryButtonDisabled: {
    opacity: 0.45,
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButtonTextDisabled: {
    color: Colors.textMuted,
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: Colors.textOnBrand,
    fontSize: 14,
    fontWeight: '800',
  },
});
