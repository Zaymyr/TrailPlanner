import type { PublicRaceAidStation, PublicRaceRoutePoint } from "../../../lib/public-race-detail";

export function PublicElevationProfile({
  points,
  aidStations,
}: {
  points: PublicRaceRoutePoint[];
  aidStations: PublicRaceAidStation[];
}) {
  const elevationPoints = points.filter(
    (point): point is PublicRaceRoutePoint & { elevationM: number } => point.elevationM !== null,
  );
  if (elevationPoints.length < 2) return null;

  const width = 720;
  const height = 250;
  const padding = { top: 24, right: 20, bottom: 38, left: 50 };
  const distance = Math.max(...elevationPoints.map((point) => point.distanceKm), 0.1);
  const elevations = elevationPoints.map((point) => point.elevationM);
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  if (minElevation === maxElevation && minElevation === 0) return null;

  const elevationRange = Math.max(maxElevation - minElevation, 1);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const x = (distanceKm: number) => padding.left + (distanceKm / distance) * plotWidth;
  const y = (elevationM: number) => padding.top + ((maxElevation - elevationM) / elevationRange) * plotHeight;
  const linePath = elevationPoints.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.distanceKm)},${y(point.elevationM)}`).join(" ");
  const areaPath = `${linePath} L${x(distance)},${padding.top + plotHeight} L${padding.left},${padding.top + plotHeight} Z`;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-0"
        role="img"
        aria-label={`Profil altimétrique de ${Math.round(minElevation)} à ${Math.round(maxElevation)} mètres sur ${distance.toFixed(1)} kilomètres`}
      >
        <defs>
          <linearGradient id="public-elevation-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {[minElevation, (minElevation + maxElevation) / 2, maxElevation].map((value) => (
          <g key={value}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(value)}
              y2={y(value)}
              stroke="currentColor"
              strokeOpacity="0.13"
              strokeDasharray="4 5"
            />
            <text x={padding.left - 8} y={y(value) + 4} textAnchor="end" className="fill-muted-foreground text-[13px]">
              {Math.round(value)} m
            </text>
          </g>
        ))}
        <path d={areaPath} fill="url(#public-elevation-fill)" />
        <path d={linePath} fill="none" stroke="hsl(var(--brand))" strokeWidth="3" strokeLinejoin="round" />
        {aidStations.map((station) => {
          const nearest = elevationPoints.reduce((best, point) =>
            Math.abs(point.distanceKm - station.distanceKm) < Math.abs(best.distanceKm - station.distanceKm) ? point : best,
          );
          return (
            <g key={station.id}>
              <line
                x1={x(station.distanceKm)}
                x2={x(station.distanceKm)}
                y1={y(nearest.elevationM)}
                y2={padding.top + plotHeight}
                stroke="#d97706"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle cx={x(station.distanceKm)} cy={y(nearest.elevationM)} r="4" fill="#d97706" />
              <circle cx={x(station.distanceKm)} cy={y(nearest.elevationM)} r="10" fill="transparent">
                <title>{station.name} · {station.distanceKm.toFixed(1)} km</title>
              </circle>
            </g>
          );
        })}
        {[0, distance / 2, distance].map((value) => (
          <text
            key={value}
            x={x(value)}
            y={height - 12}
            textAnchor={value === 0 ? "start" : value === distance ? "end" : "middle"}
            className="fill-muted-foreground text-[13px]"
          >
            {value.toFixed(value === 0 ? 0 : 1)} km
          </text>
        ))}
      </svg>
      {aidStations.length ? (
        <ul className="sr-only">
          {aidStations.map((station) => (
            <li key={station.id}>{station.name} — {station.distanceKm.toFixed(1)} km, {Math.round(station.altitudeM ?? 0)} m</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
