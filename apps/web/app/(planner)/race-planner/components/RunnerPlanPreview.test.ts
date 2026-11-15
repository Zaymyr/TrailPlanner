// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Segment } from "../types";
import { RunnerPlanPreview } from "./RunnerPlanPreview";

afterEach(cleanup);

vi.mock("../../../hooks/useRunnerPrice", () => ({
  useRunnerPrice: (offer: "annual" | "course") => ({
    status: "available",
    formatted: offer === "course" ? "10,00 €" : "30,00 €",
  }),
}));

const segment = (from: string, checkpoint: string): Segment => ({
  from,
  checkpoint,
  startDistanceKm: 0,
  distanceKm: 5,
  segmentKm: 5,
  etaMinutes: 45,
  segmentMinutes: 45,
  estimatedSegmentMinutes: 45,
  fuelGrams: 30,
  waterMl: 500,
  sodiumMg: 200,
  plannedFuelGrams: 30,
  plannedWaterMl: 500,
  plannedSodiumMg: 200,
  targetFuelGrams: 30,
  targetWaterMl: 500,
  targetSodiumMg: 200,
  gelsPlanned: 1,
  recommendedGels: 1,
});

describe("RunnerPlanPreview", () => {
  it("shows the first real section, hides the rest from accessibility and exposes one CTA", () => {
    const { container } = render(createElement(RunnerPlanPreview, {
      locale: "fr",
      planId: "11111111-1111-4111-8111-111111111111",
      duration: 180,
      distanceKm: 20,
      segments: [
        segment("Départ", "Ravito 1"),
        segment("Ravito 1", "Ravito 2"),
        segment("Ravito 2", "Arrivée"),
      ],
      onSave: vi.fn(),
    }));

    expect(screen.getByText("Départ → Ravito 1")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Débloquer toute ma préparation" })).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toContain("Ravito 1 → Ravito 2");
  });
});
