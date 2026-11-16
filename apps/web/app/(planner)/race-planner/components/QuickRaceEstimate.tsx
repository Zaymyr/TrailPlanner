"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { APP_INSTALL_HELP_URL, resolveAppStoreTarget, type AppStoreTarget } from "../../../../lib/app-store";
import { trackGoogleAnalyticsEvent } from "../../../../lib/google-analytics";
import { formatDurationHm, formatPaceMinPerKm, type QuickEstimateResult } from "../utils/quick-estimate";

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

type RaceSummary = { id: string; name: string; slug: string; distanceKm: number | null; elevationGainM: number | null; date: string | null };
type EstimateResponse = {
  fromPace: QuickEstimateResult | null;
  fromUtmb: (QuickEstimateResult & { utmbIndex: number }) | null;
};

const inputClassName =
  "h-12 w-full rounded-xl border border-border bg-background px-3 text-center text-lg font-semibold tabular-nums text-foreground outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30";

const primaryButtonClassName =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 text-base font-semibold text-brand-foreground transition hover:bg-brand-light disabled:opacity-60";

const secondaryButtonClassName =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-card px-5 text-base font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface";

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-xl bg-muted/50 px-3 py-2">
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="truncate text-base font-bold text-foreground">{value}</p>
  </div>
);

export function QuickRaceEstimate({ race, returnPath }: { race: RaceSummary | null; returnPath: string }) {
  const [paceMinutes, setPaceMinutes] = useState("");
  const [paceSeconds, setPaceSeconds] = useState("");
  const [utmbIndex, setUtmbIndex] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EstimateResponse | null>(null);
  const [appTarget, setAppTarget] = useState<AppStoreTarget>({ url: APP_INSTALL_HELP_URL, platform: "fallback" });

  useEffect(() => {
    setAppTarget(resolveAppStoreTarget(window.navigator.userAgent));
    const stored = readStoredQuickEstimateInputs();
    if (stored?.flatPaceMinPerKm) {
      const totalSeconds = Math.round(stored.flatPaceMinPerKm * 60);
      setPaceMinutes(String(Math.floor(totalSeconds / 60)));
      setPaceSeconds(String(totalSeconds % 60).padStart(2, "0"));
    }
    if (stored?.utmbIndex) setUtmbIndex(String(stored.utmbIndex));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!race) return;
    const minutes = paceMinutes.trim() ? Number(paceMinutes) : null;
    const seconds = paceSeconds.trim() ? Number(paceSeconds) : 0;
    const flatPaceMinPerKm = minutes !== null && Number.isFinite(minutes) && Number.isFinite(seconds) ? minutes + seconds / 60 : null;
    const index = utmbIndex.trim() ? Number(utmbIndex) : null;
    const hasPace = flatPaceMinPerKm !== null && flatPaceMinPerKm >= 3 && flatPaceMinPerKm <= 15;
    const hasIndex = index !== null && Number.isFinite(index) && index > 0 && index <= 1000;
    if (!hasPace && !hasIndex) {
      setError("Indique ton allure sur le plat (entre 3:00 et 15:00 /km) ou ton indice UTMB.");
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
      trackGoogleAnalyticsEvent("quick estimate completed", {
        event_category: "plan",
        source: "web_catalog",
        input: hasPace && hasIndex ? "pace_and_utmb" : hasPace ? "pace" : "utmb",
      });
    } catch {
      setStatus("error");
      setError("Impossible de calculer l’estimation pour le moment. Réessaie dans un instant.");
    }
  }

  const primary = result?.fromPace ?? result?.fromUtmb ?? null;
  const secondary = result?.fromPace && result.fromUtmb ? result.fromUtmb : null;
  const checkpoints = primary?.checkpoints ?? [];

  return (
    <section className="mx-auto w-full max-w-xl space-y-4" aria-labelledby="quick-estimate-heading">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="space-y-3 bg-brand px-4 py-4 text-brand-foreground sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">Estimation gratuite</p>
          <h2 id="quick-estimate-heading" className="text-2xl font-bold leading-tight">
            {race ? `Ton temps sur ${race.name}` : "Ton temps sur cette course"}
          </h2>
          {race ? (
            <div className="flex flex-wrap gap-2 text-sm font-semibold">
              {race.distanceKm !== null ? <span className="rounded-full bg-white/15 px-3 py-1">{race.distanceKm} km</span> : null}
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
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-foreground">Ton allure confortable sur le plat</legend>
            <div className="flex items-center gap-2">
              <input
                aria-label="Minutes par kilomètre"
                inputMode="numeric"
                placeholder="6"
                value={paceMinutes}
                onChange={(event) => setPaceMinutes(event.target.value.replace(/\D/g, "").slice(0, 2))}
                className={`${inputClassName} max-w-[5rem]`}
              />
              <span className="text-lg font-bold text-muted-foreground">:</span>
              <input
                aria-label="Secondes par kilomètre"
                inputMode="numeric"
                placeholder="30"
                value={paceSeconds}
                onChange={(event) => setPaceSeconds(event.target.value.replace(/\D/g, "").slice(0, 2))}
                className={`${inputClassName} max-w-[5rem]`}
              />
              <span className="text-sm font-medium text-muted-foreground">min/km</span>
            </div>
            <p className="text-xs text-muted-foreground">L’allure d’un footing où tu peux encore parler.</p>
          </fieldset>

          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            et / ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            <label htmlFor="quick-estimate-utmb" className="block text-sm font-semibold text-foreground">Ton indice UTMB</label>
            <input
              id="quick-estimate-utmb"
              inputMode="numeric"
              placeholder="Ex. 520"
              value={utmbIndex}
              onChange={(event) => setUtmbIndex(event.target.value.replace(/\D/g, "").slice(0, 4))}
              className={`${inputClassName} max-w-[9rem]`}
            />
          </div>

          {error ? <p role="alert" className="text-sm font-medium text-red-600">{error}</p> : null}

          <button type="submit" className={primaryButtonClassName} disabled={status === "loading" || !race}>
            {status === "loading" ? "Calcul en cours…" : result ? "Recalculer" : "Calculer mon temps"}
          </button>
        </form>
      </div>

      {primary ? (
        <div className="space-y-4" aria-live="polite">
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-4 sm:p-6">
            <p className="text-sm font-semibold text-brand">Temps estimé</p>
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
              Estimation hors pauses aux ravitos, basée sur la distance, le dénivelé et la fatigue. Affine-la dans ton plan.
            </p>
          </div>

          {checkpoints.length > 1 ? (
            <details className="group rounded-2xl border border-border bg-card" open={checkpoints.length <= 6}>
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

          <div className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h3 className="text-lg font-bold text-foreground">Transforme ce temps en plan de course</h3>
            <p className="text-sm text-muted-foreground">Crée ton compte pour enregistrer cette estimation et la retrouver sur l’app comme sur le web.</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>✓ Glucides, eau et sodium entre chaque ravito</li>
              <li>✓ Le Livret coureur officiel quand l’organisation le publie</li>
              <li>✓ Tes passages aux ravitos à partager avec tes proches</li>
            </ul>
            <a
              href={appTarget.url}
              target={appTarget.url.startsWith("https://") ? "_blank" : undefined}
              rel={appTarget.url.startsWith("https://") ? "noreferrer" : undefined}
              className={primaryButtonClassName}
              onClick={() => trackGoogleAnalyticsEvent("quick estimate app click", { event_category: "plan", platform: appTarget.platform })}
            >
              Télécharger l’app gratuite
            </a>
            <Link
              href={{ pathname: "/sign-up", query: { returnPath } }}
              className={secondaryButtonClassName}
              onClick={() => trackGoogleAnalyticsEvent("quick estimate signup click", { event_category: "plan" })}
            >
              Continuer sur le web
            </Link>
            <p className="text-center text-sm text-muted-foreground">
              Déjà un compte ?{" "}
              <Link href={{ pathname: "/sign-in", query: { returnPath } }} className="font-semibold text-brand hover:underline">
                Me connecter
              </Link>
            </p>
          </div>
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
