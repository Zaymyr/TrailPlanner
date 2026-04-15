import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutRectangle,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';

import type { ProfileTabKey } from '../components/profile/types';
import {
  addHelpTutorialRequestListener,
  type SpotlightRect,
  type TutorialStep,
} from '../lib/helpTutorial';

const TUTORIAL_MIN_TARGET_TOP = 88;
const TUTORIAL_MIN_BOTTOM_SPACE = 352;
const TUTORIAL_SCROLL_THRESHOLD = 4;
const TUTORIAL_SCROLL_FALLBACK_MS = 420;

export type ProfileTutorialTargetKey =
  | 'personal'
  | 'settings'
  | 'save'
  | 'premium'
  | 'language'
  | 'updates';

type PendingTutorialScroll = {
  targetKey: ProfileTutorialTargetKey;
  timeoutId: ReturnType<typeof setTimeout> | null;
};

type UseProfileTutorialParams = {
  activeTab: ProfileTabKey;
  onActiveTabChange: (nextTab: ProfileTabKey) => void;
  steps: TutorialStep<ProfileTutorialTargetKey>[];
};

export function useProfileTutorial({
  activeTab,
  onActiveTabChange,
  steps,
}: UseProfileTutorialParams) {
  const scrollRef = useRef<ScrollView>(null);
  const tutorialScrollOffsetRef = useRef(0);
  const pendingTutorialScrollRef = useRef<PendingTutorialScroll | null>(null);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [tutorialTargetRect, setTutorialTargetRect] = useState<SpotlightRect | null>(null);
  const [tutorialViewport, setTutorialViewport] = useState({ width: 0, height: 0 });
  const [tutorialContentHeight, setTutorialContentHeight] = useState(0);
  const [tutorialTargets, setTutorialTargets] = useState<
    Partial<Record<ProfileTutorialTargetKey, LayoutRectangle>>
  >({});

  const getTabForTutorialTarget = useCallback(
    (targetKey: ProfileTutorialTargetKey): ProfileTabKey => {
      switch (targetKey) {
        case 'personal':
          return 'personal';
        case 'settings':
          return 'performance';
        case 'premium':
        case 'language':
        case 'updates':
          return 'settings';
        case 'save':
        default:
          return activeTab;
      }
    },
    [activeTab],
  );

  const registerTutorialTarget = useCallback(
    (targetKey: ProfileTutorialTargetKey, layout: LayoutRectangle) => {
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

  const currentTutorialTargetKey = steps[tutorialStepIndex]?.targetKey ?? null;

  const clearPendingTutorialScroll = useCallback(() => {
    if (pendingTutorialScrollRef.current?.timeoutId) {
      clearTimeout(pendingTutorialScrollRef.current.timeoutId);
    }
    pendingTutorialScrollRef.current = null;
  }, []);

  const buildTutorialRect = useCallback((layout: LayoutRectangle, scrollOffset: number): SpotlightRect => {
    return {
      x: layout.x,
      y: layout.y - scrollOffset,
      width: layout.width,
      height: layout.height,
    };
  }, []);

  const completeTutorialAlignment = useCallback(
    (targetKey: ProfileTutorialTargetKey, scrollOffset: number) => {
      const layout = tutorialTargets[targetKey];
      if (!layout) {
        setTutorialTargetRect(null);
        return;
      }

      setTutorialTargetRect(buildTutorialRect(layout, scrollOffset));
      clearPendingTutorialScroll();
    },
    [buildTutorialRect, clearPendingTutorialScroll, tutorialTargets],
  );

  const alignTutorialTarget = useCallback(
    (targetKey: ProfileTutorialTargetKey) => {
      const layout = tutorialTargets[targetKey];
      if (!layout || tutorialViewport.height <= 0) {
        setTutorialTargetRect(null);
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
        completeTutorialAlignment(targetKey, currentOffset);
        return;
      }

      clearPendingTutorialScroll();
      setTutorialTargetRect(null);

      const timeoutId = setTimeout(() => {
        completeTutorialAlignment(targetKey, tutorialScrollOffsetRef.current);
      }, TUTORIAL_SCROLL_FALLBACK_MS);

      pendingTutorialScrollRef.current = { targetKey, timeoutId };
      scrollRef.current?.scrollTo({ y: desiredOffset, animated: true });
    },
    [
      clearPendingTutorialScroll,
      completeTutorialAlignment,
      tutorialContentHeight,
      tutorialTargets,
      tutorialViewport.height,
    ],
  );

  useEffect(() => {
    const removeListener = addHelpTutorialRequestListener(({ screenKey }) => {
      if (screenKey !== 'profile') return;

      clearPendingTutorialScroll();
      setTutorialTargetRect(null);
      setTutorialStepIndex(0);
      setTutorialVisible(true);
    });

    return removeListener;
  }, [clearPendingTutorialScroll]);

  useEffect(() => {
    if (!tutorialVisible || !currentTutorialTargetKey) return;

    const nextTab = getTabForTutorialTarget(currentTutorialTargetKey);
    if (activeTab !== nextTab) {
      onActiveTabChange(nextTab);
    }

    setTutorialTargetRect(null);

    const timeoutId = setTimeout(() => {
      alignTutorialTarget(currentTutorialTargetKey);
    }, activeTab === nextTab ? 0 : 40);

    return () => {
      clearTimeout(timeoutId);
      clearPendingTutorialScroll();
    };
  }, [
    activeTab,
    alignTutorialTarget,
    clearPendingTutorialScroll,
    currentTutorialTargetKey,
    getTabForTutorialTarget,
    onActiveTabChange,
    tutorialVisible,
  ]);

  const handleProfileTabChange = useCallback(
    (nextTab: ProfileTabKey) => {
      onActiveTabChange(nextTab);
      setTutorialTargetRect(null);
      clearPendingTutorialScroll();
      tutorialScrollOffsetRef.current = 0;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    },
    [clearPendingTutorialScroll, onActiveTabChange],
  );

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
      const settledOffset = event.nativeEvent.contentOffset.y;
      tutorialScrollOffsetRef.current = settledOffset;

      const pending = pendingTutorialScrollRef.current;
      if (!pending) return;

      completeTutorialAlignment(pending.targetKey, settledOffset);
    },
    [completeTutorialAlignment],
  );

  return useMemo(
    () => ({
      currentTutorialTargetKey,
      handleProfileTabChange,
      handleTutorialClose,
      handleTutorialNext,
      handleTutorialPrevious,
      handleTutorialScrollEvent,
      handleTutorialScrollSettled,
      registerTutorialTarget,
      scrollRef,
      setTutorialContentHeight,
      setTutorialViewport,
      tutorialContentHeight,
      tutorialStepIndex,
      tutorialTargetRect,
      tutorialViewport,
      tutorialVisible,
    }),
    [
      currentTutorialTargetKey,
      handleProfileTabChange,
      handleTutorialClose,
      handleTutorialNext,
      handleTutorialPrevious,
      handleTutorialScrollEvent,
      handleTutorialScrollSettled,
      registerTutorialTarget,
      tutorialContentHeight,
      tutorialStepIndex,
      tutorialTargetRect,
      tutorialViewport,
      tutorialVisible,
    ],
  );
}
