"use client";

import type { ReactNode } from "react";

import { Button } from "../ui/button";
import { ArrowRightIcon, Clock3Icon } from "./TimelineIcons";

export type SegmentListItem = {
  id: string;
  label: string;
  distanceKm: number;
  elevationGainM?: number | null;
  elevationLossM?: number | null;
  etaMinutes: number;
  icon?: ReactNode;
  segmentIndex?: number;
};

type SegmentsListProps = {
  segments: SegmentListItem[];
  formatDistance: (value: number) => string;
  formatMinutes: (value: number) => string;
  etaLabel?: string;
  deleteLabel?: string;
  onDelete?: (segmentIndex: number) => void;
};

export function SegmentsList({
  segments,
  formatDistance,
  formatMinutes,
  etaLabel = "ETA",
  deleteLabel,
  onDelete,
}: SegmentsListProps) {
  if (segments.length === 0) {
    return <p className="text-xs text-muted-foreground">Aucun segment pour le moment.</p>;
  }

  return (
    <ul className="space-y-2">
      {segments.map((segment) => (
        <li
          key={segment.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/40 px-3 py-2 text-sm text-foreground shadow-sm dark:bg-slate-900/40"
        >
          <div className="flex min-w-[220px] items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background text-foreground shadow-sm dark:bg-slate-950/70">
              {segment.icon ?? <ArrowRightIcon className="h-4 w-4" aria-hidden />}
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground dark:text-slate-50">{segment.label}</p>
              <p className="text-[11px] text-muted-foreground">{formatDistance(segment.distanceKm)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>{`D+ ${Math.round(segment.elevationGainM ?? 0)}`}</span>
              <span>{`D- ${Math.round(segment.elevationLossM ?? 0)}`}</span>
              <span className="inline-flex items-center gap-1">
                <Clock3Icon className="h-3.5 w-3.5" aria-hidden />
                {etaLabel}: {formatMinutes(segment.etaMinutes)}
              </span>
            </div>
            {onDelete && typeof segment.segmentIndex === "number" ? (
              <Button
                type="button"
                variant="ghost"
                className="h-7 px-2 text-[11px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-200 dark:hover:text-rose-100"
                onClick={() => onDelete(segment.segmentIndex)}
                aria-label={deleteLabel ? `${deleteLabel} ${segment.label}` : undefined}
                title={deleteLabel ? `${deleteLabel} ${segment.label}` : undefined}
              >
                {deleteLabel ?? "Supprimer"}
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
