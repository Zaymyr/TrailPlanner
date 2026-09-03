import type { PublicRaceAidStation } from "../../../lib/public-race-detail";

type TimelineEntry =
  | { kind: "start" }
  | { kind: "finish"; distanceKm: number | null }
  | { kind: "station"; station: PublicRaceAidStation };

function TimelineDot() {
  return <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-brand bg-card" aria-hidden="true" />;
}

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
    <ol className="ml-2 space-y-6 border-l-2 border-border pl-6">
      {entries.map((entry, index) => {
        if (entry.kind === "start") {
          return (
            <li key="start" className="relative">
              <TimelineDot />
              <p className="font-semibold text-foreground">Départ — 0 km</p>
            </li>
          );
        }
        if (entry.kind === "finish") {
          return (
            <li key="finish" className="relative">
              <TimelineDot />
              <p className="font-semibold text-foreground">
                Arrivée{entry.distanceKm !== null ? ` — ${entry.distanceKm.toLocaleString("fr-FR")} km` : ""}
              </p>
            </li>
          );
        }
        const { station } = entry;
        return (
          <li key={station.id} className="relative space-y-2">
            <TimelineDot />
            <p className="font-semibold text-foreground">
              {station.name} — {station.distanceKm.toLocaleString("fr-FR")} km
            </p>
            <div className="flex flex-wrap gap-2">
              {station.waterAvailable ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">Eau</span> : null}
              {station.solidAvailable ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Solide</span> : null}
              {station.assistanceAllowed ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Assistance</span> : null}
              {station.dropBagAvailable ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800">Sac d’allègement</span> : null}
              {station.cutoffTime ? <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">Barrière {station.cutoffTime}</span> : null}
            </div>
            {station.note ? <p className="text-sm text-muted-foreground">{station.note}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
