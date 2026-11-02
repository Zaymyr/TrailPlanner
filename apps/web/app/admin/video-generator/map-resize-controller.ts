type ResizableMap = {
  resize: () => void;
};

type ResizeObserverHandle = {
  disconnect: () => void;
  observe: (element: Element) => void;
};

type MapResizeEnvironment = {
  cancelFrame: (frameId: number) => void;
  createObserver: ((callback: () => void) => ResizeObserverHandle) | null;
  requestFrame: (callback: () => void) => number;
};

export type MapResizeController = {
  destroy: () => void;
  schedule: () => void;
};

const createBrowserEnvironment = (): MapResizeEnvironment => ({
  cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
  createObserver:
    typeof ResizeObserver === "undefined"
      ? null
      : (callback) => new ResizeObserver(() => callback()),
  requestFrame: (callback) => window.requestAnimationFrame(callback),
});

export const observeMapSize = (
  map: ResizableMap,
  container: Element,
  environment: MapResizeEnvironment = createBrowserEnvironment(),
): MapResizeController => {
  let pendingFrame: number | null = null;

  const schedule = () => {
    if (pendingFrame !== null) environment.cancelFrame(pendingFrame);
    pendingFrame = environment.requestFrame(() => {
      pendingFrame = null;
      map.resize();
    });
  };

  const observer = environment.createObserver?.(schedule) ?? null;
  observer?.observe(container);
  schedule();

  return {
    schedule,
    destroy: () => {
      if (pendingFrame !== null) environment.cancelFrame(pendingFrame);
      pendingFrame = null;
      observer?.disconnect();
    },
  };
};
