"use client";

import { useEffect, useMemo, useRef, useState, type SVGProps } from "react";

import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { estimateCarbs } from "../../lib/carb-calculator";
import {
  buildCarbCalculatorShareUrl,
  formatCarbComparison,
  getAverageSpeed,
  getCarbComparison,
  parseSharedCarbCalculatorState,
  selectCarbComparison,
  selectCarbJoke,
  type CarbComparisonId,
  type CarbJokeId,
} from "../../lib/carb-calculator-fun";

type CalculationStatus = "idle" | "calculating" | "ready";
type ShareStatus = "idle" | "shared" | "copied" | "error";

type CalculatedInput = {
  duration: number;
  tolerance: number;
  distance: number;
  elevation: number;
};

const CALCULATION_DELAY_MS = 800;

const getToleranceLabel = (value: number) => {
  if (value <= 25) return "J’ai souvent des nausées";
  if (value <= 65) return "Ça passe généralement bien";
  return "Je mange facilement en courant";
};

function RunnerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="14.5" cy="4.5" r="2.25" fill="currentColor" />
      <path
        d="m12.8 8.2-2.9 3.1 3.2 2.1 2.4 3.5m-2.7-8.7 3.2 2.4 3.1-.8M13.1 13.4l-3.5 5.1m5.9-1.6 2.2 2.6M9.9 11.3 6.2 9.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.3 10.9 7.4-4.5M8.3 13.1l7.4 4.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function CarbCalculator() {
  const [duration, setDuration] = useState(6);
  const [distance, setDistance] = useState(50);
  const [elevation, setElevation] = useState(2000);
  const [digestiveTolerance, setDigestiveTolerance] = useState(50);
  const [status, setStatus] = useState<CalculationStatus>("idle");
  const [calculatedInput, setCalculatedInput] = useState<CalculatedInput | null>(null);
  const [comparisonId, setComparisonId] = useState<CarbComparisonId | null>(null);
  const [jokeId, setJokeId] = useState<CarbJokeId | null>(null);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const calculationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastComparisonIdRef = useRef<CarbComparisonId | null>(null);
  const lastJokeIdRef = useRef<CarbJokeId | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const shouldFocusResultRef = useRef(false);

  const estimate = useMemo(
    () =>
      calculatedInput
        ? estimateCarbs({
            durationHours: calculatedInput.duration,
            digestiveTolerance: calculatedInput.tolerance,
          })
        : null,
    [calculatedInput],
  );
  const comparison = comparisonId ? getCarbComparison(comparisonId) : null;
  const comparisonMessage =
    comparison && calculatedInput && jokeId
      ? formatCarbComparison(comparison, { ...calculatedInput, jokeId })
      : null;

  useEffect(() => {
    const sharedState = parseSharedCarbCalculatorState(window.location.search);
    if (!sharedState) return;

    setDuration(sharedState.duration);
    setDistance(sharedState.distance);
    setElevation(sharedState.elevation);
    setDigestiveTolerance(sharedState.tolerance);
    setCalculatedInput({
      duration: sharedState.duration,
      tolerance: sharedState.tolerance,
      distance: sharedState.distance,
      elevation: sharedState.elevation,
    });
    setComparisonId(sharedState.comparisonId);
    setJokeId(sharedState.jokeId);
    lastComparisonIdRef.current = sharedState.comparisonId;
    lastJokeIdRef.current = sharedState.jokeId;
    setStatus("ready");
  }, []);

  useEffect(() => {
    if (status !== "ready" || !shouldFocusResultRef.current) return;
    shouldFocusResultRef.current = false;
    resultRef.current?.focus();
  }, [status]);

  useEffect(
    () => () => {
      if (calculationTimerRef.current) clearTimeout(calculationTimerRef.current);
    },
    [],
  );

  const resetResult = () => {
    setStatus("idle");
    setCalculatedInput(null);
    setComparisonId(null);
    setJokeId(null);
    setShareStatus("idle");
  };

  const handleDurationChange = (nextDuration: number) => {
    setDuration(nextDuration);
    resetResult();
  };

  const handleToleranceChange = (nextTolerance: number) => {
    setDigestiveTolerance(nextTolerance);
    resetResult();
  };

  const handleDistanceChange = (nextDistance: number) => {
    setDistance(nextDistance);
    resetResult();
  };

  const handleElevationChange = (nextElevation: number) => {
    setElevation(nextElevation);
    resetResult();
  };

  const handleCalculate = () => {
    if (calculationTimerRef.current) clearTimeout(calculationTimerRef.current);

    const nextInput = { duration, tolerance: digestiveTolerance, distance, elevation };
    setStatus("calculating");
    setCalculatedInput(null);
    setComparisonId(null);
    setJokeId(null);
    setShareStatus("idle");

    calculationTimerRef.current = setTimeout(() => {
      const nextComparison = selectCarbComparison(lastComparisonIdRef.current);
      const nextJoke = selectCarbJoke(lastJokeIdRef.current);
      lastComparisonIdRef.current = nextComparison.id;
      lastJokeIdRef.current = nextJoke.id;
      shouldFocusResultRef.current = true;
      setCalculatedInput(nextInput);
      setComparisonId(nextComparison.id);
      setJokeId(nextJoke.id);
      setStatus("ready");
      calculationTimerRef.current = null;
    }, CALCULATION_DELAY_MS);
  };

  const copyShareLink = async (shareUrl: string) => {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(shareUrl);
    setShareStatus("copied");
  };

  const handleShare = async () => {
    if (!estimate || !comparison || !calculatedInput || !comparisonMessage || !jokeId) return;

    const shareUrl = buildCarbCalculatorShareUrl(window.location.href, {
      duration: calculatedInput.duration,
      tolerance: calculatedInput.tolerance,
      distance: calculatedInput.distance,
      elevation: calculatedInput.elevation,
      comparisonId: comparison.id,
      jokeId,
    });
    const text = `Mon estimation trail sur ${calculatedInput.distance} km et ${calculatedInput.elevation} m D+ : ${estimate.carbsPerHour} g/h, soit ${estimate.totalCarbs} g au total. ${comparisonMessage}`;

    setShareStatus("idle");

    if (navigator.share) {
      try {
        await navigator.share({ title: "Mon estimation de glucides trail", text, url: shareUrl });
        setShareStatus("shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await copyShareLink(shareUrl);
    } catch {
      setShareStatus("error");
    }
  };

  const controlsDisabled = status === "calculating";

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="min-w-0">
        <CardContent className="space-y-8 py-7">
          <label className="block space-y-4 text-sm font-semibold text-foreground">
            <span className="flex items-center justify-between gap-4">
              <span>Durée prévue</span>
              <output className="shrink-0 rounded-full bg-brand-surface px-3 py-1 text-base font-bold text-brand">
                {duration} h
              </output>
            </span>
            <input
              type="range"
              min="0.5"
              max="30"
              step="0.5"
              value={duration}
              disabled={controlsDisabled}
              onChange={(event) => handleDurationChange(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-[hsl(var(--brand))] disabled:cursor-wait disabled:opacity-60"
            />
            <span className="flex justify-between text-xs font-normal text-muted-foreground">
              <span>30 min</span>
              <span>30 h</span>
            </span>
          </label>

          <label className="block space-y-4 text-sm font-semibold text-foreground">
            <span className="flex items-center justify-between gap-4">
              <span>Distance</span>
              <output className="shrink-0 rounded-full bg-brand-surface px-3 py-1 text-base font-bold text-brand">
                {distance} km
              </output>
            </span>
            <input
              type="range"
              min="5"
              max="200"
              step="5"
              value={distance}
              disabled={controlsDisabled}
              onChange={(event) => handleDistanceChange(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-[hsl(var(--brand))] disabled:cursor-wait disabled:opacity-60"
            />
            <span className="flex justify-between text-xs font-normal text-muted-foreground">
              <span>5 km</span>
              <span>200 km</span>
            </span>
          </label>

          <label className="block space-y-4 text-sm font-semibold text-foreground">
            <span className="flex items-center justify-between gap-4">
              <span>Dénivelé positif</span>
              <output className="shrink-0 rounded-full bg-brand-surface px-3 py-1 text-base font-bold text-brand">
                {elevation.toLocaleString("fr-FR")} m
              </output>
            </span>
            <input
              type="range"
              min="0"
              max="15000"
              step="100"
              value={elevation}
              disabled={controlsDisabled}
              onChange={(event) => handleElevationChange(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-[hsl(var(--brand))] disabled:cursor-wait disabled:opacity-60"
            />
            <span className="flex justify-between text-xs font-normal text-muted-foreground">
              <span>0 m</span>
              <span>15 000 m</span>
            </span>
          </label>

          <label className="block space-y-4 text-sm font-semibold text-foreground">
            <span className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <span>Tolérance digestive pendant l’effort</span>
              <output className="text-base font-bold leading-snug text-brand sm:text-right">
                {getToleranceLabel(digestiveTolerance)}
              </output>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={digestiveTolerance}
              disabled={controlsDisabled}
              onChange={(event) => handleToleranceChange(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-[hsl(var(--brand))] disabled:cursor-wait disabled:opacity-60"
            />
            <span className="grid grid-cols-3 gap-2 text-xs font-normal leading-tight text-muted-foreground">
              <span>Nausées fréquentes</span>
              <span className="text-center">Plutôt à l’aise</span>
              <span className="text-right">Très facile</span>
            </span>
          </label>

          <Button
            type="button"
            disabled={controlsDisabled}
            aria-busy={controlsDisabled}
            onClick={handleCalculate}
            className="h-12 w-full px-5 sm:w-auto"
          >
            {controlsDisabled ? (
              <>
                <span className="inline-flex motion-safe:animate-bounce motion-reduce:transform-none">
                  <RunnerIcon className="h-6 w-6" />
                </span>
                Calcul en cours…
              </>
            ) : (
              <>
                <RunnerIcon className="h-5 w-5" />
                Calculer mon apport
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="min-w-0 border-brand-border bg-brand-surface/50">
        <CardContent className="flex min-h-72 flex-col justify-center space-y-6 py-7">
          {status !== "ready" || !estimate || !comparison || !comparisonMessage || !calculatedInput ? (
            <div className="space-y-3 text-center" role="status" aria-live="polite">
              {status === "calculating" ? (
                <>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground">
                    <RunnerIcon className="h-8 w-8 motion-safe:animate-pulse" />
                  </div>
                  <p className="font-semibold text-foreground">Le petit traileur fait les calculs…</p>
                  <p className="text-sm text-muted-foreground">Encore quelques foulées.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">À vous de jouer</p>
                  <p className="text-lg font-semibold text-foreground">Réglez les quatre jauges, puis lancez le calcul.</p>
                  <p className="text-sm text-muted-foreground">Le résultat et la comparaison surprise restent cachés jusque-là.</p>
                </>
              )}
            </div>
          ) : (
            <div
              ref={resultRef}
              tabIndex={-1}
              className="min-w-0 space-y-6 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-live="polite"
            >
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Votre point de départ</p>
                <p className="mt-2 text-4xl font-bold text-foreground sm:text-5xl">{estimate.carbsPerHour} g/h</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Repère pour cette durée : {estimate.rangeMin} à {estimate.rangeMax} g/h
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-3 border-t border-border pt-5 sm:gap-4">
                <div className="min-w-0">
                  <dt className="text-sm text-muted-foreground">Total estimé</dt>
                  <dd className="text-xl font-bold text-foreground sm:text-2xl">{estimate.totalCarbs} g</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-sm text-muted-foreground">Allure moyenne</dt>
                  <dd className="text-xl font-bold text-foreground sm:text-2xl">
                    {getAverageSpeed(calculatedInput.distance, calculatedInput.duration).toFixed(1).replace(".", ",")} km/h
                  </dd>
                </div>
              </dl>

              <p className="text-xs leading-5 text-muted-foreground">
                Ce résultat est un point de départ à tester progressivement à l’entraînement. La distance et le D+
                donnent du contexte à la comparaison, mais ne modifient pas votre estimation de glucides.
              </p>

              <aside className="min-w-0 space-y-3 rounded-xl border border-brand-border bg-card p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">
                  Comparaison parfaitement injuste du jour
                </p>
                <p className="text-sm font-semibold leading-6 text-foreground">{comparisonMessage}</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  <a
                    href={comparison.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-brand underline-offset-2 hover:underline"
                  >
                    {comparison.athlete} · {comparison.race} {comparison.year} · {comparison.finishTime}
                  </a>
                </p>
              </aside>

              <div className="space-y-2">
                <Button type="button" variant="outline" onClick={handleShare} className="h-12 w-full px-5 sm:w-auto">
                  <ShareIcon className="h-5 w-5" />
                  Partager mon résultat
                </Button>
                <p className="min-h-5 text-sm text-muted-foreground" role="status" aria-live="polite">
                  {shareStatus === "copied" && "Lien copié ! Prêt à faire souffrir quelques egos."}
                  {shareStatus === "shared" && "Résultat partagé !"}
                  {shareStatus === "error" && "Impossible de copier le lien sur ce navigateur."}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
