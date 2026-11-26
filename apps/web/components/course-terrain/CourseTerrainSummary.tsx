"use client";

import React from "react";

import type { CourseTerrainLocale } from "./copy";
import { courseTerrainCopy } from "./copy";
import { buildCourseTerrainChips, type CourseTerrainView } from "./course-terrain-model";

const HATCH_STYLE: React.CSSProperties = {
  backgroundImage: "repeating-linear-gradient(45deg, #8A917E 0 2px, #F3F1EA 2px 5px)",
};

export type CourseTerrainSummaryProps = {
  /** `pending` shows the discreet analysis note; `none` (unavailable) renders nothing. */
  state: CourseTerrainView;
  locale: CourseTerrainLocale;
  className?: string;
};

/** Legend chips (« 48 % sentier · 28 % piste ») + organizer note + OSM attribution. */
export function CourseTerrainSummary({ state, locale, className }: CourseTerrainSummaryProps) {
  const copy = courseTerrainCopy[locale];
  if (state.kind === "none") return null;
  if (state.kind === "pending") {
    return <p className={`text-xs text-muted-foreground ${className ?? ""}`}>{copy.pending}</p>;
  }
  const { terrain } = state;
  const chips = buildCourseTerrainChips(terrain.summary, locale);
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground">
        {chips.map((chip) => (
          <li
            key={chip.class}
            className="inline-flex items-center gap-1.5"
            title={chip.class === "off_path" ? copy.offPathHint : undefined}
          >
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-[2px] border border-black/10"
              style={chip.hatched ? HATCH_STYLE : { backgroundColor: chip.color }}
            />
            {chip.label}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        {terrain.hasOrganizerOverrides ? <span>{copy.organizerCorrected} · </span> : null}
        <a href={terrain.attributionUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
          {terrain.attribution}
        </a>
      </p>
    </div>
  );
}
