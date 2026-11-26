"use client";

import { useState } from "react";
import type { CourseTerrainClass, CourseTerrainOverride, CourseTerrainSegment } from "@trailplanner/shared";
import { Button } from "../../../../../components/ui/button";
import { Input } from "../../../../../components/ui/input";
import { SelectField } from "../form-kit";
import {
  COURSE_TERRAIN_CLASS_OPTIONS,
  TerrainEditError,
  addRangeOverride,
  changeSegmentClass,
  formatKm,
  revertOverrideRange,
  splitSegment,
  type TerrainEditContext,
} from "./terrain-editing";

const VISIBLE_SEGMENTS = 30;

type Props = {
  segments: CourseTerrainSegment[];
  osmSegments: CourseTerrainSegment[];
  overrides: CourseTerrainOverride[];
  distanceKm: number;
  readOnly: boolean;
  onOverridesChange: (overrides: CourseTerrainOverride[]) => void;
};

const keyOf = (segment: CourseTerrainSegment) => `${segment.fromKm}-${segment.toKm}-${segment.source}`;
const formatKmInput = (value: number) => String(Math.round(value * 10) / 10);

export function TerrainSegmentsEditor({ segments, osmSegments, overrides, distanceKm, readOnly, onOverridesChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [splitKey, setSplitKey] = useState<string | null>(null);
  const [splitKm, setSplitKm] = useState("");
  const [splitClass, setSplitClass] = useState<CourseTerrainClass>("trail");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [rangeClass, setRangeClass] = useState<CourseTerrainClass>("trail");

  const ctx: TerrainEditContext = { osmSegments, overrides, distanceKm };
  const run = (action: () => CourseTerrainOverride[]) => {
    try {
      onOverridesChange(action());
      setError(null);
      return true;
    } catch (caught) {
      setError(caught instanceof TerrainEditError ? caught.message : "Correction impossible.");
      return false;
    }
  };

  const visible = showAll ? segments : segments.slice(0, VISIBLE_SEGMENTS);

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border rounded-md border border-border bg-card">
        {visible.map((segment) => {
          const key = keyOf(segment);
          const splitting = splitKey === key;
          return (
            <li key={key} className="space-y-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-36 shrink-0 text-sm font-medium tabular-nums text-foreground">
                  {formatKm(segment.fromKm)} → {formatKm(segment.toKm)} km
                </span>
                <div className="w-44">
                  <SelectField
                    aria-label={`Terrain du km ${formatKm(segment.fromKm)} au km ${formatKm(segment.toKm)}`}
                    value={segment.class}
                    disabled={readOnly}
                    options={COURSE_TERRAIN_CLASS_OPTIONS}
                    onValueChange={(value) => run(() => changeSegmentClass(ctx, segment, value as CourseTerrainClass))}
                  />
                </div>
                <span
                  className={segment.source === "organizer"
                    ? "rounded-full bg-brand-surface px-2 py-0.5 text-xs font-medium text-brand"
                    : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"}
                >
                  {segment.source === "organizer" ? "Organisateur" : "OpenStreetMap"}
                </span>
                {segment.surface ? <span className="text-xs text-muted-foreground">surface : {segment.surface}</span> : null}
                {!readOnly ? (
                  <span className="ml-auto flex flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="!min-h-9 !px-2"
                      onClick={() => {
                        setSplitKey(splitting ? null : key);
                        setSplitKm(formatKmInput((segment.fromKm + segment.toKm) / 2));
                        setSplitClass(segment.class);
                      }}
                    >
                      Scinder
                    </Button>
                    {segment.source === "organizer" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="!min-h-9 !px-2"
                        onClick={() => run(() => revertOverrideRange(ctx, segment.fromKm, segment.toKm))}
                      >
                        Rétablir OpenStreetMap
                      </Button>
                    ) : null}
                  </span>
                ) : null}
              </div>
              {splitting && !readOnly ? (
                <div className="flex flex-wrap items-end gap-2 rounded-md bg-muted/50 p-2">
                  <label className="text-xs font-medium text-foreground">
                    Scinder au km
                    <Input type="number" step="0.1" inputMode="decimal" value={splitKm} onChange={(event) => setSplitKm(event.target.value)} className="mt-1 w-28" />
                  </label>
                  <label className="text-xs font-medium text-foreground">
                    Après ce km
                    <SelectField
                      aria-label="Terrain après la coupure"
                      className="mt-1 w-44"
                      value={splitClass}
                      options={COURSE_TERRAIN_CLASS_OPTIONS}
                      onValueChange={(value) => setSplitClass(value as CourseTerrainClass)}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { if (run(() => splitSegment(ctx, segment, Number(splitKm), splitClass))) setSplitKey(null); }}
                  >
                    Appliquer
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {segments.length > VISIBLE_SEGMENTS ? (
        <Button type="button" variant="ghost" onClick={() => setShowAll((current) => !current)}>
          {showAll ? "Réduire la liste" : `Afficher les ${segments.length} tronçons`}
        </Button>
      ) : null}

      {!readOnly ? (
        <fieldset className="space-y-2 rounded-md border border-dashed border-border p-3">
          <legend className="px-1 text-sm font-medium text-foreground">Ajouter une plage</legend>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-foreground">
              Du km
              <Input type="number" step="0.1" inputMode="decimal" value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} className="mt-1 w-28" />
            </label>
            <label className="text-xs font-medium text-foreground">
              Au km
              <Input type="number" step="0.1" inputMode="decimal" value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} className="mt-1 w-28" />
            </label>
            <label className="text-xs font-medium text-foreground">
              Terrain
              <SelectField
                aria-label="Terrain de la plage"
                className="mt-1 w-44"
                value={rangeClass}
                options={COURSE_TERRAIN_CLASS_OPTIONS}
                onValueChange={(value) => setRangeClass(value as CourseTerrainClass)}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={rangeFrom === "" || rangeTo === ""}
              onClick={() => {
                if (run(() => addRangeOverride(ctx, Number(rangeFrom), Number(rangeTo), rangeClass))) {
                  setRangeFrom("");
                  setRangeTo("");
                }
              }}
            >
              Ajouter
            </Button>
          </div>
        </fieldset>
      ) : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
