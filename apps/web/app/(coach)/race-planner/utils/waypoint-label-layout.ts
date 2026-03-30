export type WaypointLabelInput = {
  index: number;
  name: string;
  x: number;
  isStart?: boolean;
  isFinish?: boolean;
  isSpecial?: boolean;
  isSelected?: boolean;
};

export type WaypointLabelPlacement = {
  index: number;
  visibleLabel: boolean;
  lane: "top" | "bottom";
  shortLabel: string;
};

const truncateLabel = (name: string, maxChars: number) => {
  const trimmed = name.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(maxChars - 1, 1)).trim()}…`;
};

export const buildWaypointLabelLayout = (
  waypoints: WaypointLabelInput[],
  options?: { widthPx?: number; maxChars?: number }
): WaypointLabelPlacement[] => {
  const widthPx = options?.widthPx ?? 900;
  const maxChars = options?.maxChars ?? (widthPx < 640 ? 12 : 16);
  const minSpacingPx = widthPx <= 420 ? 128 : widthPx <= 640 ? 104 : widthPx <= 900 ? 82 : 64;

  const byPriority = [...waypoints]
    .map((waypoint) => {
      const priority = waypoint.isStart
        ? 400
        : waypoint.isFinish
          ? 350
          : waypoint.isSelected
            ? 300
            : waypoint.isSpecial
              ? 250
              : 100;

      return { ...waypoint, priority };
    })
    .sort((a, b) => b.priority - a.priority || a.x - b.x || a.index - b.index);

  const visible: Array<{ index: number; x: number; priority: number }> = [];

  for (const waypoint of byPriority) {
    if (waypoint.isStart || waypoint.isFinish) {
      visible.push({ index: waypoint.index, x: waypoint.x, priority: waypoint.priority });
      continue;
    }

    const hasConflict = visible.some((current) => {
      if (Math.abs(current.x - waypoint.x) >= minSpacingPx) return false;
      if (current.priority < waypoint.priority) return false;
      return true;
    });

    if (!hasConflict) {
      for (let i = visible.length - 1; i >= 0; i -= 1) {
        const current = visible[i];
        if (Math.abs(current.x - waypoint.x) < minSpacingPx && current.priority < waypoint.priority) {
          visible.splice(i, 1);
        }
      }
      visible.push({ index: waypoint.index, x: waypoint.x, priority: waypoint.priority });
    }
  }

  const visibleByX = [...visible].sort((a, b) => a.x - b.x);
  const laneByIndex = new Map<number, "top" | "bottom">();
  visibleByX.forEach((item, idx) => laneByIndex.set(item.index, idx % 2 === 0 ? "top" : "bottom"));

  return waypoints
    .map((waypoint) => ({
      index: waypoint.index,
      visibleLabel: laneByIndex.has(waypoint.index),
      lane: laneByIndex.get(waypoint.index) ?? (waypoint.index % 2 === 0 ? "top" : "bottom"),
      shortLabel: truncateLabel(waypoint.name, maxChars),
    }))
    .sort((a, b) => a.index - b.index);
};
