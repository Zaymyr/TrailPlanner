"use client";

import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { LatLngExpression, LeafletMouseEvent } from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMapEvent } from "react-leaflet";

import { useI18n } from "../../app/i18n-provider";
import type { AidStationView, TracePointView } from "../../lib/trace/traceRepo";

type TraceMapProps = {
  points: TracePointView[];
  aidStations: AidStationView[];
  onAddPoint: (point: { lat: number; lng: number; elevation?: number | null }) => void;
  onUndo: () => void;
  onClear: () => void;
  onAddAidStation: (station: { lat: number; lng: number }) => void;
  onSelectAidStation?: (id?: string) => void;
  isRouting?: boolean;
  routingError?: string | null;
};

const DEFAULT_CENTER = { lat: 48.8566, lng: 2.3522 };
const DEFAULT_ZOOM = 12;

function MapClickHandler({
  mode,
  onAddAidStation,
  onAddPoint,
}: {
  mode: "route" | "aid";
  onAddPoint: TraceMapProps["onAddPoint"];
  onAddAidStation: TraceMapProps["onAddAidStation"];
}) {
  useMapEvent("click", (event: LeafletMouseEvent) => {
    const { lat, lng } = event.latlng;
    if (mode === "aid") {
      onAddAidStation({ lat, lng });
    } else {
      onAddPoint({ lat, lng, elevation: null });
    }
  });

  return null;
}

export function TraceMap({
  points,
  aidStations,
  onAddPoint,
  onUndo,
  onClear,
  onAddAidStation,
  onSelectAidStation,
  isRouting,
  routingError,
}: TraceMapProps) {
  const [mode, setMode] = useState<"route" | "aid">("route");
  const [isClient, setIsClient] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    setIsClient(true);
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: markerIcon2x.src,
      iconUrl: markerIcon.src,
      shadowUrl: markerShadow.src,
    });
  }, []);

  const mapCenter = useMemo(() => {
    if (points.length > 0) {
      return { lat: points[0].lat, lng: points[0].lng };
    }
    if (aidStations.length > 0) {
      return { lat: aidStations[0].lat, lng: aidStations[0].lng };
    }
    return DEFAULT_CENTER;
  }, [aidStations, points]);

  const routePositions = useMemo<LatLngExpression[]>(
    () => points.map((point) => [point.lat, point.lng]),
    [points]
  );

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-emerald-300/40 bg-slate-900/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("route")}
          className={`rounded-md px-3 py-1 text-sm font-medium transition ${
            mode === "route" ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-emerald-100 hover:bg-slate-700"
          }`}
        >
          {t.trace.map.addPoints}
        </button>
        <button
          type="button"
          onClick={() => setMode("aid")}
          className={`rounded-md px-3 py-1 text-sm font-medium transition ${
            mode === "aid" ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-emerald-100 hover:bg-slate-700"
          }`}
        >
          {t.trace.map.addAidStations}
        </button>
        <button
          type="button"
          onClick={onUndo}
          className="rounded-md bg-slate-800 px-3 py-1 text-sm font-medium text-emerald-100 transition hover:bg-slate-700"
          disabled={points.length === 0}
        >
          {t.trace.map.undo}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md bg-slate-800 px-3 py-1 text-sm font-medium text-emerald-100 transition hover:bg-slate-700 disabled:opacity-50"
          disabled={points.length === 0 && aidStations.length === 0}
        >
          {t.trace.map.clear}
        </button>
        {isRouting ? <span className="text-sm text-emerald-200">{t.trace.map.routing}</span> : null}
        {routingError ? <span className="text-sm text-amber-400">{routingError}</span> : null}
      </div>
      <div className="relative h-[420px] w-full overflow-hidden rounded-lg border border-emerald-900/50">
        {isClient ? (
          <MapContainer
            center={mapCenter}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom
            className="absolute inset-0 h-full w-full cursor-crosshair"
            preferCanvas
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            <MapClickHandler mode={mode} onAddAidStation={onAddAidStation} onAddPoint={onAddPoint} />

            {routePositions.length > 0 ? (
              <Polyline positions={routePositions} pathOptions={{ color: "#34d399", weight: 3 }} />
            ) : null}

            {points.map((point, index) => (
              <CircleMarker
                key={`point-${index}`}
                center={[point.lat, point.lng]}
                radius={5}
                pathOptions={{ color: "#22d3ee", fillColor: "#22d3ee", fillOpacity: 1 }}
              />
            ))}

            {aidStations.map((station) => (
              <CircleMarker
                key={station.id ?? `${station.lat}-${station.lng}`}
                center={[station.lat, station.lng]}
                radius={7}
                pathOptions={{ color: "#f97316", fillColor: "#f97316", fillOpacity: 0.9 }}
                eventHandlers={{
                  click: (event) => {
                    event.originalEvent?.stopPropagation();
                    onSelectAidStation?.(station.id);
                  },
                }}
              >
                {station.name ? <Tooltip direction="top">{station.name}</Tooltip> : null}
              </CircleMarker>
            ))}
          </MapContainer>
        ) : (
          <div className="absolute inset-0 h-full w-full bg-slate-900/50" />
        )}
        <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-3 text-xs text-slate-400">
          <p>{t.trace.map.hint}</p>
        </div>
      </div>
    </div>
  );
}
