"use client";

import { useMemo, useState } from "react";

import { Card, CardContent } from "../../components/ui/card";
import { estimateCarbs } from "../../lib/carb-calculator";

const getToleranceLabel = (value: number) => {
  if (value <= 25) return "J’ai souvent des nausées";
  if (value <= 65) return "Ça passe généralement bien";
  return "Je mange facilement en courant";
};

export function CarbCalculator() {
  const [duration, setDuration] = useState(6);
  const [digestiveTolerance, setDigestiveTolerance] = useState(50);

  const estimate = useMemo(
    () => estimateCarbs({ durationHours: duration, digestiveTolerance }),
    [digestiveTolerance, duration],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardContent className="space-y-8 py-7">
          <label className="block space-y-4 text-sm font-semibold text-foreground">
            <span className="flex items-center justify-between gap-4">
              <span>Durée prévue</span>
              <output className="rounded-full bg-brand-surface px-3 py-1 text-base font-bold text-brand">
                {duration} h
              </output>
            </span>
            <input
              type="range"
              min="0.5"
              max="30"
              step="0.5"
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-[hsl(var(--brand))]"
            />
            <span className="flex justify-between text-xs font-normal text-muted-foreground">
              <span>30 min</span>
              <span>30 h</span>
            </span>
          </label>

          <label className="block space-y-4 text-sm font-semibold text-foreground">
            <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <span>Tolérance digestive pendant l’effort</span>
              <output className="text-base font-bold text-brand">{getToleranceLabel(digestiveTolerance)}</output>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={digestiveTolerance}
              onChange={(event) => setDigestiveTolerance(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-[hsl(var(--brand))]"
            />
            <span className="grid grid-cols-3 gap-2 text-xs font-normal text-muted-foreground">
              <span>Nausées fréquentes</span>
              <span className="text-center">Plutôt à l’aise</span>
              <span className="text-right">Très facile</span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card className="border-brand-border bg-brand-surface/50">
        <CardContent className="space-y-6 py-7" aria-live="polite">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Votre point de départ</p>
            <p className="mt-2 text-5xl font-bold text-foreground">{estimate.carbsPerHour} g/h</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Repère pour cette durée : {estimate.rangeMin} à {estimate.rangeMax} g/h
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t border-border pt-5">
            <div>
              <dt className="text-sm text-muted-foreground">Total estimé</dt>
              <dd className="text-2xl font-bold text-foreground">{estimate.totalCarbs} g</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Repère de 25 g</dt>
              <dd className="text-2xl font-bold text-foreground">{estimate.portionsPerHour}/h</dd>
            </div>
          </dl>
          <p className="text-xs leading-5 text-muted-foreground">
            Cela représente environ {estimate.totalPortions} portions de 25 g sur la durée indiquée. Une portion
            peut être un gel, une boisson ou un aliment : vérifiez toujours son étiquette. En cas de nausées
            fréquentes, commencez bas et entraînez progressivement votre tolérance digestive.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
