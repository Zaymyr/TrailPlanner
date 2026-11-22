"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { raceEditHref } from "../admin-tabs";
import { formatAutomationDay } from "./automation-labels";
import type { RaceDataGapView } from "./publications-api";

type GapFilter = "reel" | "all";

const MISSING_LABELS: Record<RaceDataGapView["missing"][number], string> = { gpx: "GPX", aid_stations: "Ravitos", elevation_gain: "D+" };
const UNLOCK_LABELS = { plan: "Plan chiffré", brief: "Brief" } as const;

const formatKm = (km: number) => `${Number.isInteger(km) ? km : km.toFixed(1).replace(".", ",")} km`;

/** True when completing this format still lets an automatic reel go out. */
export const isReelReachable = (gap: RaceDataGapView) => gap.unlocks.includes("reel") && !gap.reelTooLate;

/**
 * « GPX à traiter »: the upcoming formats whose missing GPX, aid stations or D+ keep a reel or a
 * carousel from being made, the reels still reachable first with the date the data is needed by.
 */
export function RaceDataGapsCard({ gaps, leadDays, isLoading, error }: {
  gaps: RaceDataGapView[];
  leadDays: number | null;
  isLoading: boolean;
  error: string | null;
}) {
  const [filter, setFilter] = useState<GapFilter>("reel");
  const reachable = gaps.filter(isReelReachable);
  const visible = filter === "reel" ? reachable : gaps;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Courses à compléter</CardTitle>
          <CardDescription>
            Les 60 prochains jours. Un reel automatique demande un GPX et 30 km (les ravitos sont facultatifs) ; il sort 7 jours avant la course et se prépare {leadDays ?? 3} jours plus tôt, d’où la date « à compléter avant ». Le plan chiffré demande le D+ (le GPX lui donne le vrai profil), le brief au moins un ravito.
          </CardDescription>
        </div>
        <div className="inline-flex rounded-full border border-border bg-card p-1" role="group" aria-label="Filtrer les courses">
          {([["reel", `Reel encore possible (${reachable.length})`], ["all", `Tout (${gaps.length})`]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 text-sm ${filter === key ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        {isLoading ? <p className="text-muted-foreground">Chargement…</p> : null}
        {error ? <p className="text-red-600 dark:text-red-300">{error}</p> : null}
        {!isLoading && !error && visible.length === 0 ? (
          <p className="text-muted-foreground">{filter === "reel" ? "Aucune course à compléter pour un reel dans les délais." : "Rien à compléter."}</p>
        ) : null}
        {visible.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {visible.map((gap) => (
              <li key={gap.raceId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{gap.eventName ? `${gap.eventName} · ` : ""}{gap.name}</p>
                  <p className="text-xs text-muted-foreground">{formatAutomationDay(gap.date)} · {formatKm(gap.distanceKm)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Link href={raceEditHref(gap.raceId) as Route} className="rounded-full border border-brand px-2.5 py-0.5 font-medium text-brand hover:bg-brand/10 dark:border-emerald-400 dark:text-emerald-200" aria-label={`Corriger ${gap.name}`}>
                    Corriger
                  </Link>
                  {gap.missing.map((item) => (
                    <span key={item} className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                      {MISSING_LABELS[item]} manquant{item === "aid_stations" ? "s" : ""}
                    </span>
                  ))}
                  {gap.unlocks.includes("reel") ? (
                    <span className={`rounded-full px-2 py-0.5 font-medium ${gap.reelTooLate ? "bg-muted text-muted-foreground" : "bg-brand/10 text-brand dark:text-emerald-200"}`}>
                      {gap.reelTooLate || !gap.reelDeadline ? "Reel : trop tard" : `Reel · à compléter avant le ${formatAutomationDay(gap.reelDeadline)}`}
                    </span>
                  ) : null}
                  {gap.unlocks.filter((item): item is "plan" | "brief" => item !== "reel").map((item) => (
                    <span key={item} className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-900 dark:bg-violet-950/50 dark:text-violet-100">▦ {UNLOCK_LABELS[item]}</span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
