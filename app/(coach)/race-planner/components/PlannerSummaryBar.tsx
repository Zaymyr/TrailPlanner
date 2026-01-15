"use client";

import { useMemo } from "react";
import { Button } from "../../../../components/ui/button";
import type { RacePlannerTranslations } from "../../../../locales/types";
import type { RaceTotals } from "../utils/nutrition";
import { formatMinutes } from "../utils/format";

type PlannerSummaryBarProps = {
  title: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  raceTotals: RaceTotals | null;
  units: RacePlannerTranslations["units"];
  distanceUnitLabel: string;
  labels: {
    duration: string;
    distance: string;
    elevation: string;
    carbsPerHour: string;
    waterPerHour: string;
    carbsTotal: string;
    waterTotal: string;
  };
  nutritionButtonLabel: string;
  formatFuelAmount: (value: number) => string;
  formatWaterAmount: (value: number) => string;
  onNutritionClick?: () => void;
};

export function PlannerSummaryBar({
  title,
  durationMinutes,
  distanceKm,
  elevationGainM,
  raceTotals,
  units,
  distanceUnitLabel,
  labels,
  nutritionButtonLabel,
  formatFuelAmount,
  formatWaterAmount,
  onNutritionClick,
}: PlannerSummaryBarProps) {
  const durationValue = useMemo(() => {
    if (!Number.isFinite(durationMinutes ?? null) || (durationMinutes ?? 0) <= 0) return "—";
    return formatMinutes(durationMinutes ?? 0, units);
  }, [durationMinutes, units]);

  const distanceValue = useMemo(() => {
    if (!Number.isFinite(distanceKm ?? null)) return "—";
    return `${(distanceKm ?? 0).toFixed(1)} ${distanceUnitLabel}`;
  }, [distanceKm, distanceUnitLabel]);

  const elevationValue = useMemo(() => {
    if (!Number.isFinite(elevationGainM ?? null)) return "—";
    return (elevationGainM ?? 0).toFixed(0);
  }, [elevationGainM]);

  const nutritionMetrics = useMemo(() => {
    if (!raceTotals) {
      return {
        carbsLabel: labels.carbsTotal,
        carbsValue: "—",
        waterLabel: labels.waterTotal,
        waterValue: "—",
      };
    }

    if (durationMinutes && durationMinutes > 0) {
      const hours = durationMinutes / 60;
      const carbsPerHour = hours > 0 ? raceTotals.fuelGrams / hours : 0;
      const waterPerHour = hours > 0 ? raceTotals.waterMl / hours : 0;
      return {
        carbsLabel: labels.carbsPerHour,
        carbsValue: carbsPerHour.toFixed(0),
        waterLabel: labels.waterPerHour,
        waterValue: waterPerHour.toFixed(0),
      };
    }

    return {
      carbsLabel: labels.carbsTotal,
      carbsValue: formatFuelAmount(raceTotals.fuelGrams),
      waterLabel: labels.waterTotal,
      waterValue: formatWaterAmount(raceTotals.waterMl),
    };
  }, [
    durationMinutes,
    formatFuelAmount,
    formatWaterAmount,
    labels.carbsPerHour,
    labels.carbsTotal,
    labels.waterPerHour,
    labels.waterTotal,
    raceTotals,
  ]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        {onNutritionClick ? (
          <Button type="button" variant="outline" size="sm" onClick={onNutritionClick}>
            {nutritionButtonLabel}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-semibold text-foreground">
        <span className="rounded-full bg-muted px-2 py-1">
          {labels.duration}: {durationValue}
        </span>
        <span className="rounded-full bg-muted px-2 py-1">
          {labels.distance}: {distanceValue}
        </span>
        <span className="rounded-full bg-muted px-2 py-1">
          {labels.elevation}: {elevationValue}
        </span>
        <span className="rounded-full bg-muted px-2 py-1">
          {nutritionMetrics.carbsLabel}: {nutritionMetrics.carbsValue}
        </span>
        <span className="rounded-full bg-muted px-2 py-1">
          {nutritionMetrics.waterLabel}: {nutritionMetrics.waterValue}
        </span>
      </div>
    </div>
  );
}
