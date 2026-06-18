import type { Locale, RacePlannerTranslations } from "../../../../../locales/types";
import { getFuelTypeLabel } from "../../../../../components/products/FuelTypeBadge";
import type { Segment } from "../../types";
import type { AidStationPickList } from "../../utils/aid-station-picklist";
import { formatClockTime } from "../../utils/format";

const formatMetric = (
  value: number,
  target: number,
  unit: string,
  deltaLabel: string
): { primary: string; delta?: string } => {
  const roundedValue = Math.round(value);
  const roundedTarget = Math.round(target);
  const delta = roundedValue - roundedTarget;
  const deltaText = delta !== 0 ? `${delta > 0 ? "+" : ""}${delta} ${unit} ${deltaLabel}` : undefined;
  return {
    primary: `${roundedValue} ${unit}`,
    delta: deltaText,
  };
};

const formatPerHour = (total: number, minutes: number, unit: string) => {
  if (minutes <= 0) return `0 ${unit}/h`;
  const perHour = total / (minutes / 60);
  return `${Math.round(perHour)} ${unit}/h`;
};

const shouldShowPerHour = (minutes: number) => minutes > 45;

type PrintableSegmentCardProps = {
  segment: Segment;
  pickList: AidStationPickList;
  copy: RacePlannerTranslations;
  locale: Locale;
  formatDistanceWithUnit: (value: number) => string;
};

export function PrintableSegmentCard({
  segment,
  pickList,
  copy,
  locale,
  formatDistanceWithUnit,
}: PrintableSegmentCardProps) {
  const cardCopy = copy.sections.timeline.printViewV2;
  const carbs = formatMetric(
    segment.plannedFuelGrams,
    segment.targetFuelGrams,
    "g",
    cardCopy.deltaSuffix
  );
  const water = formatMetric(segment.targetWaterMl, segment.targetWaterMl, "ml", cardCopy.deltaSuffix);
  const sodium = formatMetric(
    segment.plannedSodiumMg,
    segment.targetSodiumMg,
    "mg",
    cardCopy.deltaSuffix
  );

  return (
    <section className="break-inside-avoid rounded-lg border border-slate-200 bg-white p-4 text-slate-900 shadow-sm print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <p className="text-lg font-semibold tracking-tight">{`${segment.from} → ${segment.checkpoint}`}</p>
          <p className="text-sm text-slate-600">
            {cardCopy.segmentDistance.replace("{distance}", formatDistanceWithUnit(segment.segmentKm))}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">{formatClockTime(segment.segmentMinutes)}</p>
          <p className="text-xs text-slate-500">{cardCopy.segmentTimeLabel}</p>
        </div>
      </header>

      <div className="mt-2 text-xs text-slate-500">
        {cardCopy.etaLabel.replace("{eta}", formatClockTime(segment.etaMinutes))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{cardCopy.duringLabel}</p>
          <div className="mt-2 space-y-2 text-sm">
            <div>
              <p className="font-medium">{cardCopy.carbsLabel}</p>
              <p>{carbs.primary}</p>
              {carbs.delta ? <p className="text-xs text-slate-500">{carbs.delta}</p> : null}
            </div>
            <div>
              <p className="font-medium">{cardCopy.waterLabel}</p>
              <p>{water.primary}</p>
            </div>
            <div>
              <p className="font-medium">{cardCopy.sodiumLabel}</p>
              <p>{sodium.primary}</p>
              {sodium.delta ? <p className="text-xs text-slate-500">{sodium.delta}</p> : null}
            </div>
          </div>
          {shouldShowPerHour(segment.segmentMinutes) ? (
            <div className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-500">{cardCopy.perHourLabel}</p>
              <p>{formatPerHour(segment.targetFuelGrams, segment.segmentMinutes, "g")}</p>
              <p>{formatPerHour(segment.targetWaterMl, segment.segmentMinutes, "ml")}</p>
              <p>{formatPerHour(segment.targetSodiumMg, segment.segmentMinutes, "mg")}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{cardCopy.pickupLabel}</p>
          <ul className="mt-2 space-y-2 text-sm">
            {pickList.items.map((item, index) => {
              if (item.type === "water") {
                return (
                  <li key={`water-${index}`} className="font-medium">
                    {cardCopy.fillFlasks
                      .replace("{count}", String(item.count))
                      .replace("{size}", String(item.flaskSizeMl))}
                  </li>
                );
              }

              if (item.type === "estimate") {
                return (
                  <li key={`estimate-${index}`} className="text-slate-500">
                    {cardCopy.estimateGels.replace("{count}", String(item.estimatedGels))}
                  </li>
                );
              }

              return (
                <li key={item.product.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-xs text-slate-500">{getFuelTypeLabel(item.product.fuelType, locale)}</p>
                  </div>
                  <span className="text-sm font-semibold">&times;{item.quantity}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
