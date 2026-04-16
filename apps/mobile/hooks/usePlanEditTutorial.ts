import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutRectangle,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type View,
} from 'react-native';

import type { TutorialMeasurableTarget } from '../components/help/SpotlightTutorial';
import {
  addHelpTutorialRequestListener,
  type SpotlightRect,
  type TutorialStep,
} from '../lib/helpTutorial';

const TUTORIAL_MIN_TARGET_TOP = 88;
const TUTORIAL_MIN_BOTTOM_SPACE = 352;
const TUTORIAL_SCROLL_THRESHOLD = 4;
const TUTORIAL_SCROLL_FALLBACK_MS = 420;

export type PlanEditTutorialTargetKey =
  | 'basics'
  | 'summary'
  | 'autoFill'
  | 'views'
  | 'aidStations';

type PendingTutorialScroll = {
  targetKey: PlanEditTutorialTargetKey;
  timeoutId: ReturnType<typeof setTimeout> | null;
};

type UsePlanEditTutorialParams = {
  steps: TutorialStep<PlanEditTutorialTargetKey>[];
};

export function usePlanEditTutorial({ steps }: UsePlanEditTutorialParams) {
  const rootRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const tutorialScrollOffsetRef = useRef(0);
  const tutorialTargetRefsRef = useRef<Partial<Record<PlanEditTutorialTargetKey, TutorialMeasurableTarget>>>({});
  const pendingTutorialScrollRef = useRef<PendingTutorialScroll | null>(null);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [tutorialTargetRect, setTutorialTargetRect] = useState<SpotlightRect | null>(null);
  const [tutorialViewport, setTutorialViewport] = useState({ width: 0, height: 0 });
  const [tutorialContentHeight, setTutorialContentHeight] = useState(0);
  const [tutorialTargets, setTutorialTargets] = useState<
    Partial<Record<PlanEditTutorialTargetKey, LayoutRectangle>>
  >({});

  const currentTutorialTargetKey = steps[tutorialStepIndex]?.targetKey ?? null;

  const isScrollableTarget = useCallback((_targetKey: PlanEditTutorialTargetKey) => true, []);

  const registerTutorialTarget = useCallback(
    (targetKey: PlanEditTutorialTargetKey, layout: LayoutRectangle) => {
      setTutorialTargets((current) => {
        const previous = current[targetKey];
        if (
          previous &&
          previous.x === layout.x &&
          previous.y === layout.y &&
          previous.width === layout.width &&
          previous.height === layout.height
        ) {
          return current;
        }

        return {
          ...current,
          [targetKey]: layout,
        };
      });
    },
    [],
  );

  const registerTutorialTargetRef = useCallback(
    (targetKey: PlanEditTutorialTargetKey, ref: TutorialMeasurableTarget) => {
      tutorialTargetRefsRef.current[targetKey] = ref;
    },
    [],
  );

  const clearPendingTutorialScroll = useCallback(() => {
    if (pendingTutorialScrollRef.current?.timeoutId) {
      clearTimeout(pendingTutorialScrollRef.current.timeoutId);
    }
    pendingTutorialScrollRef.current = null;
  }, []);

  const buildFallbackRect = useCallback(
    (targetKey: PlanEditTutorialTargetKey) => {
      const layout = tutorialTargets[targetKey];
      if (!layout) {
        return null;
      }

      if (!isScrollableTarget(targetKey)) {
        return {
          x: layout.x,
          y: layout.y,
          width: layout.width,
          height: layout.height,
        } satisfies SpotlightRect;
      }

      return {
        x: layout.x,
        y: layout.y - tutorialScrollOffsetRef.current,
        width: layout.width,
        height: layout.height,
      } satisfies SpotlightRect;
    },
    [isScrollableTarget, tutorialTargets],
  );

  const measureTutorialTarget = useCallback(
    (targetKey: PlanEditTutorialTargetKey) => {
      const rootNode = rootRef.current;
      const targetNode = tutorialTargetRefsRef.current[targetKey];

      if (!rootNode || !targetNode) {
        setTutorialTargetRect(buildFallbackRect(targetKey));
        return;
      }

      try {
        targetNode.measureLayout(
          rootNode,
          (x, y, width, height) => {
            setTutorialTargetRect({ x, y, width, height });
          },
          () => {
            setTutorialTargetRect(buildFallbackRect(targetKey));
          },
        );
      } catch {
        setTutorialTargetRect(buildFallbackRect(targetKey));
      }
    },
    [buildFallbackRect],
  );

  const completeTutorialAlignment = useCallback(
    (targetKey: PlanEditTutorialTargetKey) => {
      measureTutorialTarget(targetKey);
      clearPendingTutorialScroll();
    },
    [clearPendingTutorialScroll, measureTutorialTarget],
  );

  const alignTutorialTarget = useCallback(
    (targetKey: PlanEditTutorialTargetKey) => {
      const layout = tutorialTargets[targetKey];

      if (!layout || tutorialViewport.height <= 0) {
        setTutorialTargetRect(null);
        return;
      }

      if (!isScrollableTarget(targetKey)) {
        setTutorialTargetRect(null);
        requestAnimationFrame(() => {
          measureTutorialTarget(targetKey);
        });
        return;
      }

      const currentOffset = tutorialScrollOffsetRef.current;
      const visibleTop = layout.y - currentOffset;
      const visibleBottom = visibleTop + layout.height;
      const maxTargetBottom = Math.max(
        TUTORIAL_MIN_TARGET_TOP + layout.height,
        tutorialViewport.height - TUTORIAL_MIN_BOTTOM_SPACE,
      );

      let desiredOffset = currentOffset;
      if (visibleTop < TUTORIAL_MIN_TARGET_TOP) {
        desiredOffset = layout.y - TUTORIAL_MIN_TARGET_TOP;
      } else if (visibleBottom > maxTargetBottom) {
        desiredOffset = layout.y + layout.height - maxTargetBottom;
      }

      const maxScrollOffset = Math.max(0, tutorialContentHeight - tutorialViewport.height);
      desiredOffset = Math.min(Math.max(0, desiredOffset), maxScrollOffset);

      if (Math.abs(desiredOffset - currentOffset) <= TUTORIAL_SCROLL_THRESHOLD) {
        completeTutorialAlignment(targetKey);
        return;
      }

      clearPendingTutorialScroll();
      setTutorialTargetRect(null);

      const timeoutId = setTimeout(() => {
        completeTutorialAlignment(targetKey);
      }, TUTORIAL_SCROLL_FALLBACK_MS);

      pendingTutorialScrollRef.current = { targetKey, timeoutId };
      scrollRef.current?.scrollTo({ y: desiredOffset, animated: true });
    },
    [
      clearPendingTutorialScroll,
      completeTutorialAlignment,
      isScrollableTarget,
      measureTutorialTarget,
      tutorialContentHeight,
      tutorialTargets,
      tutorialViewport.height,
    ],
  );

  useEffect(() => {
    const removeListener = addHelpTutorialRequestListener(({ screenKey }) => {
      if (screenKey !== 'planEdit') return;

      clearPendingTutorialScroll();
      setTutorialTargetRect(null);
      setTutorialStepIndex(0);
      setTutorialVisible(true);
    });

    return removeListener;
  }, [clearPendingTutorialScroll]);

  useEffect(() => {
    if (!tutorialVisible || !currentTutorialTargetKey) return;

    setTutorialTargetRect(null);

    const timeoutId = setTimeout(() => {
      alignTutorialTarget(currentTutorialTargetKey);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      clearPendingTutorialScroll();
    };
  }, [
    alignTutorialTarget,
    clearPendingTutorialScroll,
    currentTutorialTargetKey,
    tutorialContentHeight,
    tutorialTargets,
    tutorialViewport.height,
    tutorialVisible,
  ]);

  useEffect(() => {
    return () => {
      clearPendingTutorialScroll();
    };
  }, [clearPendingTutorialScroll]);

  const handleTutorialClose = useCallback(() => {
    clearPendingTutorialScroll();
    setTutorialTargetRect(null);
    setTutorialVisible(false);
  }, [clearPendingTutorialScroll]);

  const handleTutorialNext = useCallback(() => {
    setTutorialStepIndex((current) => {
      if (current >= steps.length - 1) {
        clearPendingTutorialScroll();
        setTutorialTargetRect(null);
        setTutorialVisible(false);
        return current;
      }

      return current + 1;
    });
  }, [clearPendingTutorialScroll, steps.length]);

  const handleTutorialPrevious = useCallback(() => {
    clearPendingTutorialScroll();
    setTutorialStepIndex((current) => Math.max(0, current - 1));
  }, [clearPendingTutorialScroll]);

  const handleTutorialScrollEvent = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    tutorialScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  const handleTutorialScrollSettled = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      tutorialScrollOffsetRef.current = event.nativeEvent.contentOffset.y;

      const pending = pendingTutorialScrollRef.current;
      if (!pending) return;

      completeTutorialAlignment(pending.targetKey);
    },
    [completeTutorialAlignment],
  );

  return useMemo(
    () => ({
      currentTutorialTargetKey,
      handleTutorialClose,
      handleTutorialNext,
      handleTutorialPrevious,
      handleTutorialScrollEvent,
      handleTutorialScrollSettled,
      registerTutorialTarget,
      registerTutorialTargetRef,
      rootRef,
      scrollRef,
      setTutorialContentHeight,
      setTutorialViewport,
      tutorialStepIndex,
      tutorialTargetRect,
      tutorialViewport,
      tutorialVisible,
    }),
    [
      currentTutorialTargetKey,
      handleTutorialClose,
      handleTutorialNext,
      handleTutorialPrevious,
      handleTutorialScrollEvent,
      handleTutorialScrollSettled,
      registerTutorialTarget,
      registerTutorialTargetRef,
      tutorialStepIndex,
      tutorialTargetRect,
      tutorialViewport,
      tutorialVisible,
    ],
  );
}
