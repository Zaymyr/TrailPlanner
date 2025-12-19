"use client";

import { useMemo, useState } from "react";

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

type ViewPoint = { x: number; y: number };

const toViewPoint = (lat: number, lng: number): ViewPoint => {
  const x = (lng + 180) / 360;
  const y = 1 - (lat + 90) / 180;
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
};

const toLatLng = (x: number, y: number) => ({
  lat: 90 - y * 180,
  lng: x * 360 - 180,
});

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
  const { t } = useI18n();

  const viewPoints = useMemo(() => points.map((point) => toViewPoint(point.lat, point.lng)), [points]);
  const viewStations = useMemo(
    () => aidStations.map((station) => ({ ...station, view: toViewPoint(station.lat, station.lng) })),
    [aidStations]
  );

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const { lat, lng } = toLatLng(x, y);

    if (mode === "aid") {
      onAddAidStation({ lat, lng });
    } else {
      onAddPoint({ lat, lng, elevation: null });
    }
  };

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
      <div
        className="relative h-[420px] w-full cursor-crosshair rounded-lg bg-gradient-to-br from-slate-900 to-slate-950"
        onClick={handleClick}
        role="presentation"
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {viewPoints.length > 0 ? (
            <polyline
              points={viewPoints.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")}
              fill="none"
              stroke="#34d399"
              strokeWidth="0.8"
            />
          ) : null}

          {viewPoints.map((point, index) => (
            <circle key={`point-${index}`} cx={point.x * 100} cy={point.y * 100} r="1.2" fill="#22d3ee" />
          ))}

          {viewStations.map((station) => (
            <g key={station.id ?? `${station.lat}-${station.lng}`}>
              <circle
                cx={station.view.x * 100}
                cy={station.view.y * 100}
                r="1.6"
                fill="#f97316"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectAidStation?.(station.id);
                }}
              />
              <text
                x={station.view.x * 100 + 1.8}
                y={station.view.y * 100}
                className="fill-amber-200 text-[3px]"
              >
                {station.name}
              </text>
            </g>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-3 text-xs text-slate-400">
          <p>{t.trace.map.hint}</p>
        </div>
      </div>
    </div>
  );
}
