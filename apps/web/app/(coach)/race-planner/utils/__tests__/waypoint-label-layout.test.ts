import { describe, expect, it } from "vitest";
import { buildWaypointLabelLayout } from "../waypoint-label-layout";

describe("buildWaypointLabelLayout", () => {
  it("shows almost all labels when waypoints are sparse", () => {
    const layout = buildWaypointLabelLayout(
      [
        { index: 0, name: "A", x: 10, isStart: true },
        { index: 1, name: "B", x: 220 },
        { index: 2, name: "C", x: 420 },
        { index: 3, name: "D", x: 760, isFinish: true },
      ],
      { widthPx: 900 }
    );

    expect(layout.filter((l) => l.visibleLabel)).toHaveLength(4);
  });

  it("hides overlapping labels aggressively on small screens", () => {
    const layout = buildWaypointLabelLayout(
      [
        { index: 0, name: "Start", x: 10, isStart: true },
        { index: 1, name: "One", x: 60 },
        { index: 2, name: "Two", x: 95 },
        { index: 3, name: "Three", x: 130 },
        { index: 4, name: "Finish", x: 350, isFinish: true },
      ],
      { widthPx: 390 }
    );

    const visible = layout.filter((l) => l.visibleLabel).map((l) => l.index);
    expect(visible).toContain(0);
    expect(visible).toContain(4);
    expect(visible.length).toBeLessThanOrEqual(3);
  });

  it("truncates long labels", () => {
    const [label] = buildWaypointLabelLayout([{ index: 0, name: "Very very very long waypoint name", x: 120 }], {
      widthPx: 700,
      maxChars: 12,
    });

    expect(label.shortLabel.length).toBeLessThanOrEqual(12);
    expect(label.shortLabel.endsWith("…")).toBe(true);
  });

  it("keeps selected label over non-selected in conflicts", () => {
    const layout = buildWaypointLabelLayout(
      [
        { index: 0, name: "A", x: 120 },
        { index: 1, name: "B", x: 140, isSelected: true },
      ],
      { widthPx: 420 }
    );

    expect(layout.find((l) => l.index === 1)?.visibleLabel).toBe(true);
  });
});
