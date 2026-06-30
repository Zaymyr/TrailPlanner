"use client";

import { useMemo } from "react";
import type { LatLngBoundsExpression } from "leaflet";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";

import { cn } from "../utils";
import type { GpxRouteMapProps } from "./GpxRouteMap";

function FitRouteBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  map.fitBounds(bounds, { padding: [24, 24] });
  return null;
}

export function GpxRouteMapClient({
  points,
  aidStations = [],
  className,
  heightClassName = "h-56",
  interactive = true,
}: GpxRouteMapProps) {
  const latLngs = useMemo(() => points.map((point) => [point.lat, point.lon] as [number, number]), [points]);

  const bounds = useMemo<LatLngBoundsExpression>(
    () => latLngs as LatLngBoundsExpression,
    [latLngs]
  );

  const aidStationPoints = useMemo(
    () =>
      aidStations
        .map((station) => {
          const closestPoint = points.reduce<{ lat: number; lon: number; delta: number } | null>((best, point) => {
            const delta = Math.abs(point.distanceKm - station.distanceKm);
            if (!best || delta < best.delta) {
              return { lat: point.lat, lon: point.lon, delta };
            }
            return best;
          }, null);

          return closestPoint
            ? {
                ...station,
                lat: closestPoint.lat,
                lon: closestPoint.lon,
              }
            : null;
        })
        .filter((station): station is { name: string; distanceKm: number; lat: number; lon: number } => station !== null),
    [aidStations, points]
  );

  const startPoint = latLngs[0] ?? null;
  const endPoint = latLngs.at(-1) ?? null;

  return (
    <div className={cn("overflow-hidden rounded-md border border-border bg-card", className)}>
      <MapContainer
        bounds={bounds}
        scrollWheelZoom={interactive}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        boxZoom={interactive}
        keyboard={interactive}
        zoomControl={interactive}
        attributionControl
        className={cn("w-full", heightClassName)}
      >
        <FitRouteBounds bounds={bounds} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={latLngs} pathOptions={{ color: "#1f7a3f", weight: 5, opacity: 0.9 }} />
        {startPoint ? (
          <CircleMarker center={startPoint} radius={6} pathOptions={{ color: "#1f7a3f", fillColor: "#1f7a3f", fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -4]}>
              Départ
            </Tooltip>
          </CircleMarker>
        ) : null}
        {endPoint ? (
          <CircleMarker center={endPoint} radius={6} pathOptions={{ color: "#8b1e3f", fillColor: "#8b1e3f", fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -4]}>
              Arrivée
            </Tooltip>
          </CircleMarker>
        ) : null}
        {aidStationPoints.map((station) => (
          <CircleMarker
            key={`${station.name}-${station.distanceKm}`}
            center={[station.lat, station.lon]}
            radius={5}
            pathOptions={{ color: "#d89b22", fillColor: "#f3c15b", fillOpacity: 0.95 }}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              {station.name} · {station.distanceKm.toFixed(1)} km
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
