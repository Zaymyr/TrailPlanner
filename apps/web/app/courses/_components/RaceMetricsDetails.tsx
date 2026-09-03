import type { PublicRaceDetail } from "../../../lib/public-race-detail";

const formatMetric = (value: number | null, suffix: string) =>
  value === null ? "À confirmer" : `${Math.round(value).toLocaleString("fr-FR")} ${suffix}`;

export function RaceMetricsDetails({ race }: { race: PublicRaceDetail }) {
  return (
    <details className="group rounded-xl border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-semibold text-brand marker:content-none">
        Voir les détails du parcours
      </summary>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dénivelé négatif</dt>
          <dd className="mt-1 text-lg font-bold text-foreground">{formatMetric(race.elevationLossM, "m D−")}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Altitude minimale</dt>
          <dd className="mt-1 text-lg font-bold text-foreground">{formatMetric(race.minAltitudeM, "m")}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Altitude maximale</dt>
          <dd className="mt-1 text-lg font-bold text-foreground">{formatMetric(race.maxAltitudeM, "m")}</dd>
        </div>
      </dl>
    </details>
  );
}
