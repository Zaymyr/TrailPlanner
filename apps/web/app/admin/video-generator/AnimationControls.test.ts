// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnimationControls } from "./AnimationControls";

afterEach(cleanup);

const renderControls = (isPlaying = false) => {
  const callbacks = {
    onPause: vi.fn(),
    onPlay: vi.fn(),
    onRestart: vi.fn(),
    onSeek: vi.fn(),
  };
  render(createElement(AnimationControls, {
    canAnimate: true,
    currentDistanceKm: 16,
    isReady: true,
    ...callbacks,
    snapshot: { currentTimeMs: 9_000, durationMs: 45_000, progress: 0.2, isPlaying },
    totalDistanceKm: 80,
  }));
  return callbacks;
};

describe("AnimationControls", () => {
  it("shows time and distance and starts playback", async () => {
    const callbacks = renderControls();
    expect(screen.getByText("0:09 / 0:45")).toBeTruthy();
    expect(screen.getByText("16 / 80 km")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Lecture" }));
    expect(callbacks.onPlay).toHaveBeenCalledOnce();
  });

  it("pauses, restarts and seeks", async () => {
    const callbacks = renderControls(true);
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    await userEvent.click(screen.getByRole("button", { name: "Recommencer" }));
    fireEvent.change(screen.getByLabelText("Progression de l’animation"), { target: { value: "500" } });

    expect(callbacks.onPause).toHaveBeenCalledOnce();
    expect(callbacks.onRestart).toHaveBeenCalledOnce();
    expect(callbacks.onSeek).toHaveBeenCalledWith(0.5);
  });
});
