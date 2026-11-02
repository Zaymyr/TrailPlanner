import { describe, expect, it, vi } from "vitest";

import { createRouteAnimationController } from "./animation-controller";

const createClock = () => {
  let now = 0;
  let nextId = 0;
  const frames = new Map<number, (time: number) => void>();
  return {
    clock: {
      now: () => now,
      requestFrame: (callback: (time: number) => void) => {
        nextId += 1;
        frames.set(nextId, callback);
        return nextId;
      },
      cancelFrame: (frameId: number) => frames.delete(frameId),
    },
    advanceTo: (time: number) => {
      now = time;
      const queued = [...frames.values()];
      frames.clear();
      queued.forEach((callback) => callback(time));
    },
    pendingFrames: () => frames.size,
  };
};

describe("route animation controller", () => {
  it("plays, pauses and resumes from the same deterministic time", () => {
    const fake = createClock();
    const onFrame = vi.fn();
    const controller = createRouteAnimationController({
      durationMs: 1_000,
      onFrame,
      onSnapshot: vi.fn(),
      clock: fake.clock,
    });

    controller.play();
    fake.advanceTo(400);
    controller.pause();
    expect(controller.getSnapshot()).toMatchObject({ currentTimeMs: 400, isPlaying: false });

    fake.advanceTo(700);
    controller.play();
    fake.advanceTo(900);
    expect(controller.getSnapshot().currentTimeMs).toBe(600);
    expect(onFrame).toHaveBeenLastCalledWith(600);
  });

  it("seeks during playback and preserves progress when duration changes", () => {
    const fake = createClock();
    const controller = createRouteAnimationController({
      durationMs: 1_000,
      onFrame: vi.fn(),
      onSnapshot: vi.fn(),
      clock: fake.clock,
    });

    controller.play();
    fake.advanceTo(200);
    controller.seek(0.75);
    controller.setDuration(2_000);
    expect(controller.getSnapshot()).toMatchObject({ currentTimeMs: 1_500, progress: 0.75, isPlaying: true });

    fake.advanceTo(300);
    expect(controller.getSnapshot().currentTimeMs).toBe(1_600);
  });

  it("restarts, stops exactly at the end and cancels work on destroy", () => {
    const fake = createClock();
    const controller = createRouteAnimationController({
      durationMs: 1_000,
      onFrame: vi.fn(),
      onSnapshot: vi.fn(),
      clock: fake.clock,
    });

    controller.seek(0.8);
    controller.restart();
    expect(controller.getSnapshot()).toMatchObject({ currentTimeMs: 0, isPlaying: true });
    fake.advanceTo(1_200);
    expect(controller.getSnapshot()).toMatchObject({ currentTimeMs: 1_000, progress: 1, isPlaying: false });
    expect(fake.pendingFrames()).toBe(0);

    controller.restart();
    expect(fake.pendingFrames()).toBe(1);
    controller.destroy();
    expect(fake.pendingFrames()).toBe(0);
  });
});
