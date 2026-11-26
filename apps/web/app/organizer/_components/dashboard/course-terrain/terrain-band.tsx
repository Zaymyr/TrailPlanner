import {
  COURSE_TERRAIN_ATTRIBUTION,
  COURSE_TERRAIN_ATTRIBUTION_URL,
  COURSE_TERRAIN_CLASSES,
  COURSE_TERRAIN_CLASS_COLORS,
  type CourseTerrainClass,
  type CourseTerrainSegment,
  type CourseTerrainSummary,
} from "@trailplanner/shared";
import { COURSE_TERRAIN_CLASS_LABELS, formatKm, formatPct } from "./terrain-editing";

const HATCH = "repeating-linear-gradient(135deg, rgba(0,0,0,0.28) 0 2px, transparent 2px 6px)";

function classStyle(terrainClass: CourseTerrainClass) {
  return terrainClass === "off_path"
    ? { backgroundColor: COURSE_TERRAIN_CLASS_COLORS.off_path, backgroundImage: HATCH }
    : { backgroundColor: COURSE_TERRAIN_CLASS_COLORS[terrainClass] };
}

export function TerrainBand({ segments, distanceKm }: { segments: CourseTerrainSegment[]; distanceKm: number }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ratio * distanceKm);
  return (
    <div>
      <div
        role="img"
        aria-label={`Bande de terrain sur ${formatKm(distanceKm)} km`}
        className="flex h-6 w-full overflow-hidden rounded-md border border-border"
      >
        {segments.map((segment) => (
          <div
            key={`${segment.fromKm}-${segment.toKm}-${segment.source}`}
            title={`${COURSE_TERRAIN_CLASS_LABELS[segment.class]} · ${formatKm(segment.fromKm)} → ${formatKm(segment.toKm)} km`}
            style={{ width: `${((segment.toKm - segment.fromKm) / distanceKm) * 100}%`, ...classStyle(segment.class) }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground" aria-hidden="true">
        {ticks.map((tick) => <span key={tick}>{formatKm(tick)} km</span>)}
      </div>
    </div>
  );
}

export function TerrainSummaryList({ summary }: { summary: CourseTerrainSummary }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {COURSE_TERRAIN_CLASSES.map((terrainClass) => (
        <li key={terrainClass} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm border border-black/10" style={classStyle(terrainClass)} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-foreground">{COURSE_TERRAIN_CLASS_LABELS[terrainClass]}</span>
            <span className="block text-xs text-muted-foreground">{formatKm(summary[terrainClass].km)} km · {formatPct(summary[terrainClass].pct)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TerrainAttribution() {
  return (
    <a href={COURSE_TERRAIN_ATTRIBUTION_URL} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline underline-offset-2">
      {COURSE_TERRAIN_ATTRIBUTION}
    </a>
  );
}
