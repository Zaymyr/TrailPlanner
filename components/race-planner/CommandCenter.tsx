"use client";

import type { RacePlannerTranslations } from "../../locales/types";
import { AlertsRow } from "./AlertsRow";
import { MetricCard } from "../ui/MetricCard";
import { SectionHeader } from "../ui/SectionHeader";
import { Card, CardContent, CardHeader } from "../ui/card";

type RaceTotals = {
  fuelGrams: number;
  waterMl: number;
  sodiumMg: number;
  durationMinutes: number;
};

type CommandCenterProps = {
  totals: RaceTotals | null;
  targets?: {
    carbsPerHour?: number | null;
    waterPerHour?: number | null;
    sodiumPerHour?: number | null;
  } | null;
  copy: RacePlannerTranslations;
  formatDuration: (totalMinutes: number) => string;
};

const formatPerHour = (value: number | null | undefined, unit: string) => {
  if (!Number.isFinite(value ?? null)) return null;
  return `≈ ${Math.round(value ?? 0)} ${unit}/hr`;
};

const isBelowTarget = (actual?: number | null, target?: number | null) =>
  Number.isFinite(actual ?? null) && Number.isFinite(target ?? null) && (actual ?? 0) < (target ?? 0);

const isAboveTarget = (actual?: number | null, target?: number | null) =>
  Number.isFinite(actual ?? null) && Number.isFinite(target ?? null) && (actual ?? 0) > (target ?? 0);

export function CommandCenter({ totals, targets, copy, formatDuration }: CommandCenterProps) {
  if (!totals) {
    return (
      <Card>
        <CardHeader className="pb-0">
          <SectionHeader title={copy.sections.summary.title} description={copy.sections.summary.description} />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">{copy.sections.summary.empty}</p>
        </CardContent>
      </Card>
    );
  }

  const durationHours = totals.durationMinutes > 0 ? totals.durationMinutes / 60 : null;
  const carbsPerHour = durationHours ? totals.fuelGrams / durationHours : null;
  const waterPerHour = durationHours ? totals.waterMl / durationHours : null;
  const sodiumPerHour = durationHours ? totals.sodiumMg / durationHours : null;

  const carbsPerHourLabel = formatPerHour(carbsPerHour, copy.units.grams);
  const waterPerHourLabel = formatPerHour(waterPerHour, copy.units.milliliters);
  const sodiumPerHourLabel = formatPerHour(sodiumPerHour, copy.units.milligrams);

  const carbsHelper =
    carbsPerHourLabel && targets?.carbsPerHour && Number.isFinite(targets.carbsPerHour)
      ? `${carbsPerHourLabel} (${targets.carbsPerHour.toFixed(0)} ${copy.units.grams}/hr target)`
      : carbsPerHourLabel ?? undefined;

  const waterHelper =
    waterPerHourLabel && targets?.waterPerHour && Number.isFinite(targets.waterPerHour)
      ? `${waterPerHourLabel} (${targets.waterPerHour.toFixed(0)} ${copy.units.milliliters}/hr target)`
      : waterPerHourLabel ?? undefined;

  const sodiumHelper =
    sodiumPerHourLabel && targets?.sodiumPerHour && Number.isFinite(targets.sodiumPerHour)
      ? `${sodiumPerHourLabel} (${targets.sodiumPerHour.toFixed(0)} ${copy.units.milligrams}/hr target)`
      : sodiumPerHourLabel ?? undefined;

  return (
    <Card>
      <CardHeader className="space-y-3 pb-0">
        <SectionHeader title={copy.sections.summary.title} description={copy.sections.summary.description} />
        <AlertsRow
          summaryCopy={copy.sections.summary}
          units={copy.units}
          actuals={{ carbsPerHour, waterPerHour, sodiumPerHour }}
          targets={targets}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          <MetricCard
            label={copy.sections.summary.items.duration}
            value={formatDuration(totals.durationMinutes)}
          />
          <MetricCard
            label={copy.sections.summary.items.carbs}
            value={`${totals.fuelGrams.toFixed(0)} ${copy.units.grams}`}
            helper={carbsHelper}
            tone={isBelowTarget(carbsPerHour, targets?.carbsPerHour) ? "warning" : "default"}
          />
          <MetricCard
            label={copy.sections.summary.items.water}
            value={`${totals.waterMl.toFixed(0)} ${copy.units.milliliters}`}
            helper={waterHelper}
            tone={isBelowTarget(waterPerHour, targets?.waterPerHour) ? "warning" : "default"}
          />
          <MetricCard
            label={copy.sections.summary.items.sodium}
            value={`${totals.sodiumMg.toFixed(0)} ${copy.units.milligrams}`}
            helper={sodiumHelper}
            tone={isAboveTarget(sodiumPerHour, targets?.sodiumPerHour) ? "warning" : "default"}
          />
        </div>
      </CardContent>
    </Card>
  );
}
