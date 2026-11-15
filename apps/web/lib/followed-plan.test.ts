import { describe, expect, it } from "vitest";

import {
  buildFollowedPreparation,
  buildFollowedSupporterTimeline,
  resolveFollowedPlanCompletionAt,
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
});
