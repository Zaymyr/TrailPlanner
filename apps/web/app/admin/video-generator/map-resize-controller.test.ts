import { describe, expect, it, vi } from "vitest";

import { observeMapSize } from "./map-resize-controller";

describe("observeMapSize", () => {
  it("resizes after layout and whenever the observed container changes", () => {
    const resize = vi.fn();
    const disconnect = vi.fn();
    const observe = vi.fn();
    const cancelFrame = vi.fn();
    const frames = new Map<number, () => void>();
    let observerCallback: (() => void) | null = null;
    let nextFrameId = 0;

    const controller = observeMapSize({ resize }, {} as Element, {
      cancelFrame: (frameId) => {
        cancelFrame(frameId);
        frames.delete(frameId);
      },
      createObserver: (callback) => {
        observerCallback = callback;
        return { disconnect, observe };
      },
      requestFrame: (callback) => {
        nextFrameId += 1;
        frames.set(nextFrameId, callback);
        return nextFrameId;
      },
    });

    expect(observe).toHaveBeenCalledOnce();
    expect(frames.size).toBe(1);

    observerCallback?.();
    expect(cancelFrame).toHaveBeenCalledWith(1);
    expect(frames.size).toBe(1);

    frames.get(2)?.();
    expect(resize).toHaveBeenCalledOnce();

    controller.schedule();
    frames.get(3)?.();
    expect(resize).toHaveBeenCalledTimes(2);

    controller.destroy();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("still schedules a resize when ResizeObserver is unavailable", () => {
    const resize = vi.fn();
    let frameCallback: (() => void) | null = null;

    const controller = observeMapSize({ resize }, {} as Element, {
      cancelFrame: vi.fn(),
      createObserver: null,
      requestFrame: (callback) => {
        frameCallback = callback;
        return 1;
      },
    });

    frameCallback?.();
    expect(resize).toHaveBeenCalledOnce();
    controller.destroy();
  });
});
