"use client";

import { useMemo, useState } from "react";

import type { Goal } from "../../contexts/OnboardingContext";
import { estimateCarbs } from "../../lib/carb-calculator";
import { Card, CardContent } from "../../components/ui/card";

const parseNumber = (value: string) => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function CarbCalculator() {
  const [duration, setDuration] = useState("6");
  const [distance, setDistance] = useState("45");
  const [elevation, setElevation] = useState("1800");
  const [goal, setGoal] = useState<Goal>("good_time");

  const estimate = useMemo(
    () =>
      estimateCarbs({
        durationHours: parseNumber(duration),
        distanceKm: parseNumber(distance),
        elevationGainM: parseNumber(elevation),
        goal,
      }),
    [distance, duration, elevation, goal],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardContent className="grid gap-5 py-7 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-foreground">
            Durée estimée (heures)
            <input
              type="number"
              min="0.5"
              max="100"
              step="0.5"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="h-11 w-full rounded-md border border-border bg-background px-3 font-normal outline-none focus:border-brand-border focus:ring-2 focus:ring-ring/30"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-foreground">
            Distance (km)
            <input
              type="number"
              min="1"
              max="500"
              step="1"
              value={distance}
              onChange={(event) => setDistance(event.target.value)}
              className="h-11 w-full rounded-md border border-border bg-background px-3 font-normal outline-none focus:border-brand-border focus:ring-2 focus:ring-ring/30"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-foreground">
            Dénivelé positif (m)
            <input
              type="number"
              min="0"
              max="30000"
              step="100"
              value={elevation}
              onChange={(event) => setElevation(event.target.value)}
              className="h-11 w-full rounded-md border border-border bg-background px-3 font-normal outline-none focus:border-brand-border focus:ring-2 focus:ring-ring/30"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-foreground">
            Objectif
            <select
              value={goal}
              onChange={(event) => setGoal(event.target.value as Goal)}
              className="h-11 w-full rounded-md border border-border bg-background px-3 font-normal outline-none focus:border-brand-border focus:ring-2 focus:ring-ring/30"
            >
              <option value="comfort">Finir confortablement</option>
              <option value="good_time">Faire un bon temps</option>
              <option value="performance">Performance</option>
            </select>
          </label>
        </CardContent>
      </Card>

      <Card className="border-brand-border bg-brand-surface/50">
        <CardContent className="space-y-6 py-7" aria-live="polite">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Votre point de départ</p>
            <p className="mt-2 text-5xl font-bold text-foreground">{estimate.carbsPerHour} g/h</p>
            <p className="mt-2 text-sm text-muted-foreground">de glucides à tester progressivement à l’entraînement</p>
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
            peut être un gel, une boisson ou un aliment : vérifiez toujours son étiquette.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
