import { describe, expect, it } from "vitest";

import {
  buildFollowedPreparation,
  buildFollowedSupporterTimeline,
  buildPlanShareCheckpointHandover,
  buildPlanShareTimeline,
  formatPlanShareClockInput,
  isPlanShareCheckpointPassed,
  resolveFollowedPlanCompletionAt,
  resolvePlanSharePassageCorrection,
  type FollowedPlanCheckpoint,
} from "@trailplanner/shared";

const checkpoints: FollowedPlanCheckpoint[] = [
  { index: 0, name: "Départ", distanceKm: 0, arrivalMinute: 0, isStart: true, isFinish: false, assistanceState: "start" },
  { index: 1, name: "Ravito", distanceKm: 20, arrivalMinute: 120, isStart: false, isFinish: false, assistanceState: "available", waterState: "refill", supplies: [{ productId: "gel", name: "Gel", quantity: 2 }] },
  { index: 2, name: "Arrivée", distanceKm: 40, arrivalMinute: 240, isStart: false, isFinish: true, assistanceState: "finish" },
];

describe("followed plan field helpers", () => {
  it("interpolates supporter points and recalibrates them after a confirmed passage", () => {
    const [planned] = buildFollowedSupporterTimeline([{ id: "p", km: 30 }], checkpoints, [], "08:00");
    const [recalibrated] = buildFollowedSupporterTimeline([{ id: "p", km: 30 }], checkpoints, [{ checkpointIndex: 1, actualMinute: 150, confirmedAt: "2026-01-01T00:00:00Z" }], "08:00");
    expect(planned.elapsedMinute).toBe(180);
    expect(recalibrated.elapsedMinute).toBe(210);
  });

  it("aggregates preparation per assistance point, globally, and for water", () => {
    const result = buildFollowedPreparation(checkpoints, 1.5);
    expect(result.points[0]).toMatchObject({ checkpointIndex: 1, water: 1.5 });
    expect(result.totals).toEqual([{ productId: "gel", name: "Gel", quantity: 2 }]);
    expect(result.totalWaterLiters).toBe(1.5);
  });

  it("places a multi-day finish cutoff after its explicit day offset and margin", () => {
    expect(resolveFollowedPlanCompletionAt({
      raceDate: "2026-06-20", officialStartTime: "14:00", totalDurationMin: 600,
      finishCutoffTime: "01:00", finishCutoffDayOffset: 2,
    })).toBe("2026-06-22T07:00:00.000Z");
  });

  it("resolves a corrected passage clock to the day nearest the planned passage", () => {
    expect(resolvePlanSharePassageCorrection("10:15", "08:00", { arrivalMinute: 120 })).toBe(135);
    expect(resolvePlanSharePassageCorrection("01:10", "22:00", { arrivalMinute: 180 })).toBe(190);
    expect(resolvePlanSharePassageCorrection("25:00", "08:00", { arrivalMinute: 120 })).toBeNull();
    expect(resolvePlanSharePassageCorrection("10:15", "", { arrivalMinute: 120 })).toBeNull();
    expect(formatPlanShareClockInput(1440 + 75)).toBe("01:15");
  });

  it("treats confirmed checkpoints and everything before the last confirmation as passed", () => {
    const none = buildPlanShareTimeline(checkpoints, [], "08:00");
    expect(isPlanShareCheckpointPassed(checkpoints[0]!, none)).toBe(false);
    const atFinish = buildPlanShareTimeline(checkpoints, [{ checkpointIndex: 2, actualMinute: 250, confirmedAt: "now" }], "08:00");
    expect(checkpoints.map((checkpoint) => isPlanShareCheckpointPassed(checkpoint, atFinish))).toEqual([true, true, true]);
  });

  it("lists products then the bladder refill as the crew handover checklist", () => {
    expect(buildPlanShareCheckpointHandover(checkpoints[1]!, 1.5)).toEqual([
      { key: "1:gel", kind: "product", name: "Gel", quantity: 2, liters: null },
      { key: "1:water", kind: "water", name: "water", quantity: null, liters: 1.5 },
    ]);
    expect(buildPlanShareCheckpointHandover(checkpoints[2]!, 1.5)).toEqual([]);
  });
});
