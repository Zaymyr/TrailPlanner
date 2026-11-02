// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnimationControls } from "./AnimationControls";

afterEach(cleanup);

const renderControls = () => {
  const callbacks = {
    onDurationChange: vi.fn(),
    onPause: vi.fn(),
    onPlay: vi.fn(),
    onRestart: vi.fn(),
    onRevealModeChange: vi.fn(),
    onSeek: vi.fn(),
    onViewportChange: vi.fn(),
  };
  render(createElement(AnimationControls, {
    canAnimate: true,
    durationSeconds: 45,
    isReady: true,
    ...callbacks,
    revealMode: "progressive",
    snapshot: { currentTimeMs: 9_000, durationMs: 45_000, progress: 0.2, isPlaying: false },
    totalDistanceKm: 80,
    viewport: "portrait",
  }));
  return callbacks;
};

describe("AnimationControls", () => {
  it("shows the phase defaults and starts playback", async () => {
    const callbacks = renderControls();
    expect((screen.getByLabelText("Durée de l’animation") as HTMLSelectElement).value).toBe("45");
    expect((screen.getByLabelText("Affichage du tracé") as HTMLSelectElement).value).toBe("progressive");
    expect(screen.getByRole("button", { name: "Instagram 9:16" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("16 km")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Lecture" }));
    expect(callbacks.onPlay).toHaveBeenCalledOnce();
  });

  it("supports a bounded custom duration and seeking", async () => {
    const callbacks = renderControls();
    await userEvent.selectOptions(screen.getByLabelText("Durée de l’animation"), "custom");
    const customInput = screen.getByLabelText("Durée personnalisée en secondes");
    await userEvent.clear(customInput);
    await userEvent.type(customInput, "120");
    expect(callbacks.onDurationChange).toHaveBeenLastCalledWith(120);

    const timeline = screen.getByLabelText("Progression de l’animation");
    fireEvent.change(timeline, { target: { value: "500" } });
    expect(callbacks.onSeek).toHaveBeenCalledWith(0.5);
  });

  it("switches the viewport and route presentation", async () => {
    const callbacks = renderControls();
    await userEvent.click(screen.getByRole("button", { name: "Classique 16:9" }));
    await userEvent.selectOptions(screen.getByLabelText("Affichage du tracé"), "full");
    expect(callbacks.onViewportChange).toHaveBeenCalledWith("landscape");
    expect(callbacks.onRevealModeChange).toHaveBeenCalledWith("full");
  });
});
