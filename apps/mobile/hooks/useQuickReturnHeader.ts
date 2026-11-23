import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Keyboard,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { INITIAL_QUICK_RETURN_STATE, nextQuickReturnState } from '../lib/quickReturnHeader';
import { useReduceMotion } from './useReduceMotion';

const ANIMATION_MS = 180;

type Options = {
  /** Scroll position driving the existing expanded → compact collapse; updated by the returned handler. */
  scrollY: Animated.Value;
  /** Offset under which the header always stays shown (top of the list, collapse range). */
  threshold: number;
  /** Off during guided onboarding or any state where the header must stay put. */
  enabled?: boolean;
};

/**
 * "Quick return" root header: it slides away while the reader scrolls down a long
 * list and comes back as soon as they scroll up (decision logic in
 * `lib/quickReturnHeader.ts`).
 *
 * `hideProgress` goes 0 (shown) → 1 (hidden). Each consumer maps it to its own
 * travel (the header, and the catalog's sticky search card that leaves with it).
 * The header always stays shown near the top, while the keyboard is open, and
 * when reduce motion or a screen reader is on.
 */
export function useQuickReturnHeader({ scrollY, threshold, enabled = true }: Options) {
  const reduceMotion = useReduceMotion();
  const [screenReader, setScreenReader] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const hideProgress = useRef(new Animated.Value(0)).current;
  const stateRef = useRef(INITIAL_QUICK_RETURN_STATE);
  const active = enabled && !reduceMotion && !screenReader && !keyboardOpen;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (mounted) setScreenReader(value);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const animateTo = useCallback((hidden: boolean) => {
    // JS driver: the header's height already follows scrollY on the JS side.
    Animated.timing(hideProgress, {
      toValue: hidden ? 1 : 0,
      duration: ANIMATION_MS,
      useNativeDriver: false,
    }).start();
  }, [hideProgress]);

  useEffect(() => {
    if (active || !stateRef.current.hidden) return;
    stateRef.current = { ...stateRef.current, hidden: false, travel: 0 };
    animateTo(false);
  }, [active, animateTo]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    scrollY.setValue(contentOffset.y);
    const previous = stateRef.current;
    const next = nextQuickReturnState(previous, {
      offsetY: contentOffset.y,
      contentHeight: contentSize.height,
      viewportHeight: layoutMeasurement.height,
      threshold,
      active,
    });
    stateRef.current = next;
    if (next.hidden !== previous.hidden) animateTo(next.hidden);
  }, [active, animateTo, scrollY, threshold]);

  return { hideProgress, onScroll };
}
