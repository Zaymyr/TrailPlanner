import type { Route } from "next";
import Link from "next/link";

import { formatDurationHm, formatPaceMinPerKm } from "../../(planner)/race-planner/utils/quick-estimate";
import type { ReferenceEstimate } from "../[slug]/race-time-estimates";

/**
 * « Combien de temps pour finir ? » block: reference times per runner level,
 * then the personal estimate CTA. The question heading matches how runners
 * search for a race and gives each course page unique, useful content.
 */
export function RaceTimeEstimates({
  raceName,
  estimates,
  estimateHref,
}: {
  raceName: string;
  estimates: ReferenceEstimate[];
  estimateHref: string;
}) {
  if (!estimates.length) return null;

  return (
    <section id="temps" className="scroll-mt-16 space-y-3" aria-labelledby="race-time-heading">
      <h2 id="race-time-heading" className="text-xl font-bold text-foreground sm:text-2xl">
        Combien de temps pour finir {raceName} ?
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="grid grid-cols-3 divide-x divide-border">
          {estimates.map((estimate) => (
            <li key={estimate.key} className="px-2 py-3 text-center sm:px-4 sm:py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{estimate.label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground sm:text-2xl">{formatDurationHm(estimate.totalSeconds)}</p>
              <p className="text-[11px] text-muted-foreground sm:text-xs">{formatPaceMinPerKm(estimate.flatPaceMinPerKm)} sur le plat</p>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3 border-t border-border bg-brand-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Et toi ?</span> Ton allure sur le plat ou ton indice UTMB suffit pour obtenir ton temps et tes passages aux ravitos.
          </p>
          <Link
            href={estimateHref as Route}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light"
          >
            Calculer mon temps
          </Link>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Estimations Pace Yourself à partir de la distance, du dénivelé et de la fatigue, hors pauses. Elles ne remplacent pas les barrières horaires officielles.
      </p>
    </section>
  );
}
