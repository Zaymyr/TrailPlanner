"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { APP_INSTALL_HELP_URL, resolveAppStoreTarget, type AppStoreTarget } from "../../../../lib/app-store";
import { trackGoogleAnalyticsEvent } from "../../../../lib/google-analytics";
import { trackQuickEstimateCompleted } from "../../../../lib/product-analytics";
import { rememberFunnelSourceRace } from "../../../../lib/race-funnel-source";
import { FLAT_PACE_MAX, FLAT_PACE_MIN, formatDurationHm, formatPaceMinPerKm, type QuickEstimateResult } from "../utils/quick-estimate";

export const QUICK_ESTIMATE_STORAGE_KEY = "runner.quickEstimate";

export type StoredQuickEstimateInputs = { flatPaceMinPerKm: number | null; utmbIndex: number | null };

export function readStoredQuickEstimateInputs(): StoredQuickEstimateInputs | null {
  try {
    const raw = window.sessionStorage.getItem(QUICK_ESTIMATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredQuickEstimateInputs>;
    return {
      flatPaceMinPerKm: typeof parsed.flatPaceMinPerKm === "number" ? parsed.flatPaceMinPerKm : null,
      utmbIndex: typeof parsed.utmbIndex === "number" ? parsed.utmbIndex : null,
    };
  } catch {
    return null;
  }
}

/** Reference flat distance of the « temps sur le plat » input. */
const FLAT_REFERENCE_KM = 10;

type InputMode = "pace" | "flatTime";

/** Real starting values (not placeholders) so the first « Calculer » click works without typing. */
const MODE_DEFAULTS: Record<InputMode, { first: string; second: string }> = {
  pace: { first: "6", second: "30" },
  flatTime: { first: "55", second: "00" },
};
type RaceSummary = { id: string; name: string; slug: string; distanceKm: number | null; elevationGainM: number | null; date: string | null };
type EstimateResponse = {
  fromPace: QuickEstimateResult | null;
  fromUtmb: (QuickEstimateResult & { utmbIndex: number }) | null;
};

const inputClassName =
  "h-12 w-full rounded-xl border border-border bg-background px-3 text-center text-lg font-semibold tabular-nums text-foreground outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30";

const primaryButtonClassName =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-base font-semibold text-brand-foreground transition hover:bg-brand-light disabled:opacity-60";

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-xl bg-card/70 px-3 py-2">
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="truncate text-base font-bold text-foreground">{value}</p>
  </div>
);

const digits = (value: string, max: number) => value.replace(/\D/g, "").slice(0, max);

/**
 * Account-free estimate of a catalog race: flat pace (or a flat 10 km time) and/or UTMB Index → total time
 * and ravito passages. The primary next step opens the free plan preview (`onOpenPlan`), where the visitor
 * prepares the departure and the first aid station before being asked for an account.
 */
export function QuickRaceEstimate({
  race,
  onOpenPlan,
  isOpeningPlan = false,
}: {
  race: RaceSummary | null;
  /** Opens the free plan preview with the flat pace the estimate used (min/km). */
  onOpenPlan: (flatPaceMinPerKm: number) => void;
  isOpeningPlan?: boolean;
}) {
  const [mode, setMode] = useState<InputMode>("pace");
  const [firstValue, setFirstValue] = useState(MODE_DEFAULTS.pace.first);
  const [secondValue, setSecondValue] = useState(MODE_DEFAULTS.pace.second);
  const [utmbIndex, setUtmbIndex] = useState("");
  const [showUtmb, setShowUtmb] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EstimateResponse | null>(null);
  const [appTarget, setAppTarget] = useState<AppStoreTarget>({ url: APP_INSTALL_HELP_URL, platform: "fallback" });

  useEffect(() => {
    setAppTarget(resolveAppStoreTarget(window.navigator.userAgent));
    const stored = readStoredQuickEstimateInputs();
    if (stored?.flatPaceMinPerKm) {
      const totalSeconds = Math.round(stored.flatPaceMinPerKm * 60);
      setFirstValue(String(Math.floor(totalSeconds / 60)));
      setSecondValue(String(totalSeconds % 60).padStart(2, "0"));
    }
    if (stored?.utmbIndex) {
      setUtmbIndex(String(stored.utmbIndex));
      setShowUtmb(true);
    }
  }, []);

  const raceId = race?.id ?? null;
  useEffect(() => {
    rememberFunnelSourceRace(raceId);
  }, [raceId]);

  const switchMode = (next: InputMode) => {
    if (next === mode) return;
    setMode(next);
    setFirstValue(MODE_DEFAULTS[next].first);
    setSecondValue(MODE_DEFAULTS[next].second);
    setError(null);
  };

  /** Flat pace in min/km from the active input, or null when empty/invalid. */
  const readFlatPace = (): number | null => {
    if (!firstValue.trim()) return null;
    const first = Number(firstValue);
    const second = secondValue.trim() ? Number(secondValue) : 0;
    if (!Number.isFinite(first) || !Number.isFinite(second) || second > 59) return null;
    const minutes = first + second / 60;
    return mode === "pace" ? minutes : minutes / FLAT_REFERENCE_KM;
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!race) return;
    const flatPaceMinPerKm = readFlatPace();
    const index = utmbIndex.trim() ? Number(utmbIndex) : null;
    const hasPace = flatPaceMinPerKm !== null && flatPaceMinPerKm >= FLAT_PACE_MIN && flatPaceMinPerKm <= FLAT_PACE_MAX;
    const hasIndex = index !== null && Number.isFinite(index) && index > 0 && index <= 1000;
    if (!hasPace && !hasIndex) {
      setError(
        mode === "pace"
          ? "Indique ton allure sur le plat, entre 3:00 et 15:00 /km."
          : "Indique ton temps sur 10 km plat, entre 30 min et 2 h 30.",
      );
      return;
    }

    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/race-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogRaceId: race.id,
          flatPaceMinPerKm: hasPace ? flatPaceMinPerKm : null,
          utmbIndex: hasIndex ? index : null,
        }),
      });
      if (!response.ok) throw new Error("estimate failed");
      const data = (await response.json()) as EstimateResponse;
      setResult(data);
      setStatus("idle");
      try {
        window.sessionStorage.setItem(
          QUICK_ESTIMATE_STORAGE_KEY,
          JSON.stringify({ flatPaceMinPerKm: hasPace ? flatPaceMinPerKm : null, utmbIndex: hasIndex ? index : null }),
        );
      } catch {
        // Storage is a convenience only.
      }
      trackQuickEstimateCompleted({
        input: hasPace && hasIndex ? "pace_and_utmb" : hasPace ? "pace" : "utmb",
        sourceRace: race.id,
      });
    } catch {
      setStatus("error");
      setError("Impossible de calculer l’estimation pour le moment. Réessaie dans un instant.");
    }
  }

  const primary = result?.fromPace ?? result?.fromUtmb ?? null;
  const secondary = result?.fromPace && result.fromUtmb ? result.fromUtmb : null;
  const checkpoints = primary?.checkpoints ?? [];
  // `checkpoints` lists the aid stations then « Arrivée » (no departure).
  const aidStationCount = Math.max(0, checkpoints.length - 1);
  const firstAidStation = checkpoints.length > 1 ? checkpoints[0] : null;

  const openPlan = () => {
    if (!primary) return;
    trackGoogleAnalyticsEvent("quick estimate open plan", { event_category: "plan", race_id: race?.id });
    onOpenPlan(primary.flatPaceMinPerKm);
  };

  return (
    <section className="mx-auto w-full max-w-xl space-y-4" aria-labelledby="quick-estimate-heading">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="space-y-3 bg-brand px-4 py-5 text-brand-foreground sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">Gratuit · sans compte · 30 secondes</p>
          <h2 id="quick-estimate-heading" className="text-2xl font-bold leading-tight">
            {race ? `Ton temps sur ${race.name}` : "Ton temps sur cette course"}
          </h2>
          {race ? (
            <div className="flex flex-wrap gap-2 text-sm font-semibold">
              {race.distanceKm !== null ? <span className="rounded-full bg-white/15 px-3 py-1">{race.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km</span> : null}
              {race.elevationGainM !== null ? <span className="rounded-full bg-white/15 px-3 py-1">{Math.round(race.elevationGainM).toLocaleString("fr-FR")} m D+</span> : null}
              {race.date ? (
                <span className="rounded-full bg-white/15 px-3 py-1">
                  {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${race.date.slice(0, 10)}T12:00:00Z`))}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <form onSubmit={submit} className="space-y-4 p-4 sm:p-6" noValidate>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Ce que tu connais">
            {(
              [
                ["pace", "Mon allure /km"],
                ["flatTime", "Mon temps sur 10 km"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => switchMode(value)}
                className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition ${
                  mode === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-foreground">
              {mode === "pace" ? "Ton allure confortable sur le plat" : "Ton temps sur 10 km plat, sans forcer"}
            </legend>
            <div className="flex items-center gap-2">
              <input
                aria-label={mode === "pace" ? "Minutes par kilomètre" : "Minutes"}
                inputMode="numeric"
                value={firstValue}
                onChange={(event) => setFirstValue(digits(event.target.value, mode === "pace" ? 2 : 3))}
                className={`${inputClassName} max-w-[5.5rem]`}
              />
              <span className="text-lg font-bold text-muted-foreground">{mode === "pace" ? ":" : "min"}</span>
              <input
                aria-label="Secondes"
                inputMode="numeric"
                value={secondValue}
                onChange={(event) => setSecondValue(digits(event.target.value, 2))}
                className={`${inputClassName} max-w-[5rem]`}
              />
              <span className="text-sm font-medium text-muted-foreground">{mode === "pace" ? "min/km" : "s"}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "pace" ? "L’allure d’un footing où tu peux encore parler." : "Un 10 km tranquille, pas ton record."}
            </p>
          </fieldset>

          {showUtmb ? (
            <div className="space-y-2">
              <label htmlFor="quick-estimate-utmb" className="block text-sm font-semibold text-foreground">Ton indice UTMB (optionnel)</label>
              <input
                id="quick-estimate-utmb"
                inputMode="numeric"
                placeholder="Ex. 520"
                value={utmbIndex}
                onChange={(event) => setUtmbIndex(digits(event.target.value, 4))}
                className={`${inputClassName} max-w-[9rem]`}
              />
            </div>
          ) : (
            <button type="button" onClick={() => setShowUtmb(true)} className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
              + J’ai un indice UTMB
            </button>
          )}

          {error ? <p role="alert" className="text-sm font-medium text-pace-semantic-danger">{error}</p> : null}

          <button type="submit" className={primaryButtonClassName} disabled={status === "loading" || !race}>
            {status === "loading" ? "Calcul en cours…" : result ? "Recalculer" : "Calculer mon temps"}
          </button>
        </form>
      </div>

      {primary ? (
        <div className="space-y-4" aria-live="polite">
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-4 sm:p-6">
            <p className="text-sm font-semibold text-brand">Ton temps estimé</p>
            <p className="text-5xl font-bold tracking-tight text-foreground tabular-nums">{formatDurationHm(primary.totalSeconds)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric label="Allure moyenne" value={formatPaceMinPerKm(primary.averagePaceMinPerKm)} />
              <Metric label="Base sur le plat" value={formatPaceMinPerKm(primary.flatPaceMinPerKm)} />
            </div>
            {secondary ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Avec ton indice UTMB {secondary.utmbIndex} : <span className="font-semibold text-foreground">{formatDurationHm(secondary.totalSeconds)}</span>
              </p>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">
              Calculé sur la distance, le dénivelé et la fatigue, hors pauses aux ravitos.
            </p>
          </div>

          <div className="space-y-4 rounded-2xl border-2 border-brand bg-card p-4 shadow-md sm:p-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Étape suivante · gratuit</p>
              <h3 className="text-xl font-bold leading-tight text-foreground">Ton temps, c’est bien. Ton plan de course, c’est mieux.</h3>
              <p className="text-sm text-muted-foreground">
                {firstAidStation
                  ? `Prépare tout de suite ta course jusqu’à ${firstAidStation.name} (km ${firstAidStation.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}) : ce que tu emportes au départ, ce que tu manges et bois, ton heure de passage.`
                  : "Prépare tout de suite ton départ : ce que tu emportes, ce que tu manges et bois, tes heures de passage."}
              </p>
            </div>
            <ul className="space-y-1.5 text-sm text-foreground">
              <li className="flex gap-2"><span aria-hidden className="font-bold text-brand">✓</span>Glucides, eau et sodium calculés pour ton allure</li>
              <li className="flex gap-2"><span aria-hidden className="font-bold text-brand">✓</span>Tes gels, barres et boissons placés au bon moment</li>
              <li className="flex gap-2">
                <span aria-hidden className="font-bold text-brand">✓</span>
                {aidStationCount > 1
                  ? `Tes ${aidStationCount} ravitos et tes heures de passage`
                  : aidStationCount === 1
                    ? "Ton ravito et ton heure de passage"
                    : "Tes heures de passage jusqu’à l’arrivée"}
              </li>
            </ul>
            <button type="button" onClick={openPlan} className={primaryButtonClassName} disabled={isOpeningPlan}>
              {isOpeningPlan ? "Ouverture du plan…" : "Voir mon plan de course →"}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Gratuit : ton départ et ton premier ravito. Le plan complet (tous les ravitos, fiche à imprimer, assistance) se débloque ensuite.
            </p>
            <p className="text-center text-xs text-muted-foreground">Sans compte, sans carte bancaire.</p>
          </div>

          {checkpoints.length > 1 ? (
            <details className="group rounded-2xl border border-border bg-card">
              <summary className="flex min-h-12 cursor-pointer items-center justify-between px-4 text-sm font-semibold text-foreground marker:content-none">
                Tes passages aux ravitos
                <span className="text-muted-foreground transition group-open:rotate-180" aria-hidden="true">▾</span>
              </summary>
              <ol className="divide-y divide-border border-t border-border">
                {checkpoints.map((checkpoint) => (
                  <li key={`${checkpoint.name}-${checkpoint.distanceKm}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{checkpoint.name}</span>
                      <span className="text-xs text-muted-foreground">km {checkpoint.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">{formatDurationHm(checkpoint.elapsedSeconds)}</span>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}

          <p className="text-center text-sm text-muted-foreground">
            Tu préfères ton téléphone ?{" "}
            <a
              href={appTarget.url}
              target={appTarget.url.startsWith("https://") ? "_blank" : undefined}
              rel={appTarget.url.startsWith("https://") ? "noreferrer" : undefined}
              className="font-semibold text-brand underline-offset-4 hover:underline"
              onClick={() => trackGoogleAnalyticsEvent("quick estimate app click", { event_category: "plan", platform: appTarget.platform })}
            >
              Télécharge l’app gratuite
            </a>
          </p>
        </div>
      ) : null}

      {race?.slug ? (
        <Link href={`/courses/${race.slug}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline">
          ← Retour à la fiche {race.name}
        </Link>
      ) : null}
    </section>
  );
}
