import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';

import type { SpotlightRect } from '../lib/helpTutorial';
import type { RacebookTourStepSpec, RacebookTourTargetKey } from '../lib/racebookOnboardingTour';

/** Delay before the precise scroll: the tab switch and its scroll restore render first. */
const ALIGN_DELAY_MS = 120;
/** Delay before the first measurement, once the scroll is applied. */
const MEASURE_DELAY_MS = 280;
const MEASURE_RETRY_MS = 200;
const MEASURE_MAX_ATTEMPTS = 8;
/** Late pass for content that grows after the first layout (maps, images). */
const SETTLE_MEASURE_MS = 800;

type Options = {
  active: boolean;
  steps: RacebookTourStepSpec[];
  /** Shows the step's tab/sub-tab (state changes only). */
  prepareStep: (step: RacebookTourStepSpec) => void;
  /** Scrolls so the step's zone is visible. */
  alignStep: (step: RacebookTourStepSpec) => void;
  /** Turns a measured zone (root coordinates) into the highlighted rect, or null when not visible yet. */
  fitTarget: (step: RacebookTourStepSpec, rect: SpotlightRect) => SpotlightRect | null;
};

function sameRect(left: SpotlightRect | null, right: SpotlightRect) {
  return Boolean(left)
    && Math.abs((left as SpotlightRect).x - right.x) < 1
    && Math.abs((left as SpotlightRect).y - right.y) < 1
    && Math.abs((left as SpotlightRect).width - right.width) < 1
    && Math.abs((left as SpotlightRect).height - right.height) < 1;
}

/**
 * Drives the guided RaceBook tour: current step, measured target zones
 * (real views, `measureInWindow` relative to the screen root) and the
 * viewport handed to `SpotlightTutorial`.
 */
export function useRacebookOnboardingTour({ active, steps, prepareStep, alignStep, fitTarget }: Options) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<SpotlightRect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const rootRef = useRef<View>(null);
  const targetsRef = useRef(new Map<RacebookTourTargetKey, View>());
  const targetCallbacksRef = useRef(new Map<RacebookTourTargetKey, (node: View | null) => void>());
  const prepareRef = useRef(prepareStep);
  const alignRef = useRef(alignStep);
  const fitRef = useRef(fitTarget);
  prepareRef.current = prepareStep;
  alignRef.current = alignStep;
  fitRef.current = fitTarget;

  const clampedIndex = Math.min(stepIndex, Math.max(0, steps.length - 1));
  const step = active ? steps[clampedIndex] ?? null : null;

  const registerTarget = useCallback((key: RacebookTourTargetKey) => {
    let callback = targetCallbacksRef.current.get(key);
    if (!callback) {
      callback = (node: View | null) => {
        if (node) targetsRef.current.set(key, node);
        else targetsRef.current.delete(key);
      };
      targetCallbacksRef.current.set(key, callback);
    }
    return callback;
  }, []);

  const handleRootLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport((current) => (
      current.width === width && current.height === height ? current : { width, height }
    ));
  }, []);

  useEffect(() => {
    if (!step) return undefined;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const target = step.target;

    prepareRef.current(step);
    timers.push(setTimeout(() => {
      if (!cancelled) alignRef.current(step);
    }, ALIGN_DELAY_MS));

    if (!target) {
      setTargetRect(null);
      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
      };
    }

    const measure = (attempt: number, retry: boolean) => {
      if (cancelled) return;
      const node = targetsRef.current.get(target);
      const root = rootRef.current;
      const scheduleRetry = () => {
        if (retry && attempt < MEASURE_MAX_ATTEMPTS) {
          timers.push(setTimeout(() => measure(attempt + 1, true), MEASURE_RETRY_MS));
        }
      };
      if (!node || !root) {
        scheduleRetry();
        return;
      }
      root.measureInWindow((rootX, rootY) => {
        node.measureInWindow((x, y, width, height) => {
          if (cancelled) return;
          const fitted = fitRef.current(step, { x: x - rootX, y: y - rootY, width, height });
          if (!fitted) {
            scheduleRetry();
            return;
          }
          setTargetRect((current) => (sameRect(current, fitted) ? current : fitted));
        });
      });
    };

    timers.push(setTimeout(() => measure(0, true), MEASURE_DELAY_MS));
    timers.push(setTimeout(() => measure(MEASURE_MAX_ATTEMPTS, false), SETTLE_MEASURE_MS));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [step]);

  const goNext = useCallback(() => {
    setStepIndex((current) => Math.min(current + 1, Math.max(0, steps.length - 1)));
  }, [steps.length]);

  const goPrevious = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  return {
    goNext,
    goPrevious,
    handleRootLayout,
    isLastStep: clampedIndex >= steps.length - 1,
    registerTarget,
    rootRef,
    stepIndex: clampedIndex,
    targetRect,
    viewport,
  };
}
