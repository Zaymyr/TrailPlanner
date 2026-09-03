import type { ReactNode } from "react";

import type { PublicRaceAidStation } from "../../../lib/public-race-detail";

type TimelineEntry =
  | { kind: "start" }
  | { kind: "finish"; distanceKm: number | null }
  | { kind: "station"; station: PublicRaceAidStation };

const dotColor: Record<TimelineEntry["kind"], string> = {
  start: "border-emerald-600 bg-emerald-600",
  finish: "border-rose-800 bg-rose-800",
  station: "border-amber-500 bg-amber-500",
};

export function RaceAidStationsTimeline({
  aidStations,
  totalDistanceKm,
}: {
  aidStations: PublicRaceAidStation[];
  totalDistanceKm: number | null;
}) {
  const entries: TimelineEntry[] = [
    { kind: "start" },
    ...aidStations.map((station): TimelineEntry => ({ kind: "station", station })),
    { kind: "finish", distanceKm: totalDistanceKm },
  ];

  return (
    <ol className="rounded-xl border border-border bg-card p-5">
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1;

        let heading: ReactNode;
        let details: ReactNode = null;
        if (entry.kind === "start") {
          heading = (
            <>
              Départ <span className="font-normal text-muted-foreground">— 0 km</span>
            </>
          );
        } else if (entry.kind === "finish") {
          heading = (
            <>
              Arrivée
              {entry.distanceKm !== null ? (
                <span className="font-normal text-muted-foreground"> — {entry.distanceKm.toLocaleString("fr-FR")} km</span>
              ) : null}
            </>
          );
        } else {
          const { station } = entry;
          heading = (
            <>
              {station.name} <span className="font-normal text-muted-foreground">— {station.distanceKm.toLocaleString("fr-FR")} km</span>
            </>
          );
          details = (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                {station.waterAvailable ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">Eau</span> : null}
                {station.solidAvailable ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Solide</span> : null}
                {station.assistanceAllowed ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Assistance</span> : null}
                {station.dropBagAvailable ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800">Sac d’allègement</span> : null}
                {station.cutoffTime ? <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">Barrière {station.cutoffTime}</span> : null}
              </div>
              {station.note ? <p className="text-sm italic text-muted-foreground">{station.note}</p> : null}
            </div>
          );
        }

        return (
          <li key={entry.kind === "station" ? entry.station.id : entry.kind} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 ${dotColor[entry.kind]}`} aria-hidden="true" />
              {!isLast ? <span className="w-0.5 flex-1 bg-border" aria-hidden="true" /> : null}
            </div>
            <div className={isLast ? "pb-0" : "pb-6"}>
              <p className="font-semibold text-foreground">{heading}</p>
              {details}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
