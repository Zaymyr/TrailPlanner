import type { ReactNode } from "react";

import type { PublicRaceAidStation, PublicRaceAidStationSummary } from "../../../lib/public-race-detail";
import { buildAidStationTimelineEntries, type AidStationTimelineEntry } from "./catalog-display";

const dotColor: Record<AidStationTimelineEntry["kind"], string> = {
  start: "border-emerald-600 bg-emerald-600",
  finish: "border-rose-800 bg-rose-800",
  station: "border-amber-500 bg-amber-500",
};

const formatKm = (value: number) => `${value.toLocaleString("fr-FR")} km`;

function StationDetails({
  station,
  stationDetails,
}: {
  station: PublicRaceAidStationSummary;
  stationDetails: PublicRaceAidStation | undefined;
}) {
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        {station.waterAvailable ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">Eau</span> : null}
        {station.solidAvailable ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Solide</span> : null}
        {stationDetails?.assistanceAllowed ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Assistance</span> : null}
        {stationDetails?.dropBagAvailable ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800">Sac d’allègement</span> : null}
        {stationDetails?.cutoffTime ? <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">Barrière {stationDetails.cutoffTime}</span> : null}
      </div>
      {stationDetails ? (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {stationDetails.altitudeM !== null ? <div><dt className="inline font-semibold">Altitude :</dt> <dd className="inline">{Math.round(stationDetails.altitudeM)} m</dd></div> : null}
          {stationDetails.cumulativeElevationGainM !== null ? <div><dt className="inline font-semibold">D+ cumulé :</dt> <dd className="inline">{Math.round(stationDetails.cumulativeElevationGainM)} m</dd></div> : null}
          {stationDetails.cumulativeElevationLossM !== null ? <div><dt className="inline font-semibold">D- cumulé :</dt> <dd className="inline">{Math.round(stationDetails.cumulativeElevationLossM)} m</dd></div> : null}
        </dl>
      ) : null}
      {stationDetails?.note ? <p className="text-sm italic text-muted-foreground">{stationDetails.note}</p> : null}
    </div>
  );
}

export function RaceAidStationsTimeline({
  aidStations,
  aidStationDetails,
  totalDistanceKm,
}: {
  aidStations: PublicRaceAidStationSummary[];
  aidStationDetails: PublicRaceAidStation[] | null;
  totalDistanceKm: number | null;
}) {
  const detailsById = new Map((aidStationDetails ?? []).map((station) => [station.id, station]));
  // Organizer rows that already are the start or the finish are merged into that endpoint.
  const entries = buildAidStationTimelineEntries(aidStations, totalDistanceKm);

  return (
    <ol className="rounded-2xl border border-border bg-card p-4">
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1;

        let heading: ReactNode;
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
                <span className="font-normal text-muted-foreground"> — {formatKm(entry.distanceKm)}</span>
              ) : null}
            </>
          );
        } else {
          heading = (
            <>
              {entry.station.name} <span className="font-normal text-muted-foreground">— {formatKm(entry.station.distanceKm)}</span>
            </>
          );
        }
        const station = entry.station;

        return (
          <li key={station ? station.id : entry.kind} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 ${dotColor[entry.kind]}`} aria-hidden="true" />
              {!isLast ? <span className="w-0.5 flex-1 bg-border" aria-hidden="true" /> : null}
            </div>
            <div className={isLast ? "pb-0" : "pb-4"}>
              <p className="font-semibold text-foreground">{heading}</p>
              {station ? <StationDetails station={station} stationDetails={detailsById.get(station.id)} /> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
