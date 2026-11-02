export type AnimationPlaybackSnapshot = {
  currentTimeMs: number;
  durationMs: number;
  progress: number;
  isPlaying: boolean;
};

type AnimationClock = {
  now: () => number;
  requestFrame: (callback: (time: number) => void) => number;
  cancelFrame: (frameId: number) => void;
};

type AnimationControllerOptions = {
  durationMs: number;
  onFrame: (timeMs: number) => void;
  onSnapshot: (snapshot: AnimationPlaybackSnapshot) => void;
  clock?: AnimationClock;
};

export type RouteAnimationController = {
  play: () => void;
  pause: () => void;
  restart: () => void;
  seek: (progress: number) => void;
  setDuration: (durationMs: number) => void;
  getSnapshot: () => AnimationPlaybackSnapshot;
  destroy: () => void;
};

const UI_UPDATE_INTERVAL_MS = 100;

const defaultClock = (): AnimationClock => ({
  now: () => performance.now(),
  requestFrame: (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
});

const clampProgress = (progress: number) => Math.min(1, Math.max(0, progress));

export const createRouteAnimationController = ({
  clock = defaultClock(),
  durationMs: initialDurationMs,
  onFrame,
  onSnapshot,
}: AnimationControllerOptions): RouteAnimationController => {
  let durationMs = Math.max(1, initialDurationMs);
  let currentTimeMs = 0;
  let isPlaying = false;
  let anchorMs = 0;
  let frameId: number | null = null;
  let lastSnapshotAt = Number.NEGATIVE_INFINITY;
  let destroyed = false;

  const getSnapshot = (): AnimationPlaybackSnapshot => ({
    currentTimeMs,
    durationMs,
    progress: clampProgress(currentTimeMs / durationMs),
    isPlaying,
  });

  const emit = (forceSnapshot = false, timestamp = clock.now()) => {
    onFrame(currentTimeMs);
    if (forceSnapshot || timestamp - lastSnapshotAt >= UI_UPDATE_INTERVAL_MS) {
      lastSnapshotAt = timestamp;
      onSnapshot(getSnapshot());
    }
  };

  const cancelScheduledFrame = () => {
    if (frameId === null) return;
    clock.cancelFrame(frameId);
    frameId = null;
  };

  const tick = (timestamp: number) => {
    frameId = null;
    if (!isPlaying || destroyed) return;
    currentTimeMs = Math.min(durationMs, Math.max(0, timestamp - anchorMs));
    if (currentTimeMs >= durationMs) {
      isPlaying = false;
      emit(true, timestamp);
      return;
    }
    emit(false, timestamp);
    frameId = clock.requestFrame(tick);
  };

  const schedule = () => {
    if (frameId !== null || !isPlaying || destroyed) return;
    frameId = clock.requestFrame(tick);
  };

  const syncPlayingTime = (now: number) => {
    if (!isPlaying) return;
    currentTimeMs = Math.min(durationMs, Math.max(0, now - anchorMs));
  };

  emit(true);

  return {
    play: () => {
      if (destroyed || isPlaying) return;
      if (currentTimeMs >= durationMs) currentTimeMs = 0;
      const now = clock.now();
      anchorMs = now - currentTimeMs;
      isPlaying = true;
      emit(true, now);
      schedule();
    },
    pause: () => {
      if (destroyed || !isPlaying) return;
      const now = clock.now();
      syncPlayingTime(now);
      isPlaying = false;
      cancelScheduledFrame();
      emit(true, now);
    },
    restart: () => {
      if (destroyed) return;
      cancelScheduledFrame();
      currentTimeMs = 0;
      const now = clock.now();
      anchorMs = now;
      isPlaying = true;
      emit(true, now);
      schedule();
    },
    seek: (progress) => {
      if (destroyed) return;
      const now = clock.now();
      currentTimeMs = durationMs * clampProgress(progress);
      if (isPlaying) anchorMs = now - currentTimeMs;
      emit(true, now);
    },
    setDuration: (nextDurationMs) => {
      if (destroyed) return;
      const now = clock.now();
      syncPlayingTime(now);
      const progress = clampProgress(currentTimeMs / durationMs);
      durationMs = Math.max(1, nextDurationMs);
      currentTimeMs = durationMs * progress;
      if (isPlaying) anchorMs = now - currentTimeMs;
      emit(true, now);
    },
    getSnapshot,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      isPlaying = false;
      cancelScheduledFrame();
    },
  };
};
