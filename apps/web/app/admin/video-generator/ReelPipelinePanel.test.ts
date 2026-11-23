// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { createReelPipelineState } from "./reel-pipeline";
import { ReelPipelinePanel, type ReelPipelineMode } from "./ReelPipelinePanel";

const pipeline = (running = false) => ({
  state: createReelPipelineState(),
  cancelRequested: false,
  running,
  start: vi.fn(),
  resume: vi.fn(),
  cancel: vi.fn(),
});

const panel = (mode: ReelPipelineMode, onModeChange = vi.fn(), running = false) =>
  render(React.createElement(ReelPipelinePanel, { canRun: true, mode, recommendedMode: "full", onModeChange, pipeline: pipeline(running) }));

describe("ReelPipelinePanel", () => {
  it("lets the admin pick Parcours complet or Temps forts, and marks the advised one", () => {
    const onModeChange = vi.fn();
    panel("highlights", onModeChange);
    const full = screen.getByRole("radio", { name: /Parcours complet/ });
    expect(full.textContent).toContain("★");
    expect(screen.getByRole("radio", { name: /Temps forts/ }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(full);
    expect(onModeChange).toHaveBeenCalledWith("full");
    expect(screen.getByTestId("reel-pipeline").textContent).toContain("Rédige le texte « Temps forts »");
  });

  it("explains the full-course flow and locks the choice while a reel is generating", () => {
    panel("full", vi.fn(), true);
    expect(screen.getByRole("radio", { name: /Temps forts/ }).hasAttribute("disabled")).toBe(true);
  });

  it("describes the full-course flow before it starts", () => {
    panel("full");
    expect(screen.getByTestId("reel-pipeline").textContent).toContain("tronçon par tronçon puis la légende Instagram");
  });

  it("links the launched render in the render queue and the drafts in Publications once the render started", () => {
    render(React.createElement(ReelPipelinePanel, {
      canRun: true,
      mode: "full",
      recommendedMode: "full",
      onModeChange: vi.fn(),
      renderJobId: "job-1",
      pipeline: { ...pipeline(), state: { ...createReelPipelineState(), status: "done" } },
    }));
    expect(screen.getByRole("link", { name: "la file des rendus" }).getAttribute("href")).toBe("/admin/content/renders?rendu=job-1");
    expect(screen.getByRole("link", { name: "Publications" }).getAttribute("href")).toBe("/admin/content/posts");
  });
});
