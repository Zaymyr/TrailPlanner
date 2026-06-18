import type { Locale, RacePlannerTranslations } from "../../../../../locales/types";
import type { FuelProduct } from "../../../../../lib/product-types";
import type { Segment } from "../../types";
import { buildAidStationPickList } from "../../utils/aid-station-picklist";
import { PrintableSegmentCard } from "./PrintableSegmentCard";

export type PrintablePlanV2Strategy = {
  carbsPerHour: number;
  waterMlPerHour: number;
  sodiumMgPerHour: number;
  flaskSizeMl?: number;
};

type PrintablePlanV2Props = {
  segments: Segment[];
  raceName: string;
  exportDate: string;
  strategy: PrintablePlanV2Strategy;
  products: FuelProduct[];
  copy: RacePlannerTranslations;
  locale: Locale;
  formatDistanceWithUnit: (value: number) => string;
};

export function PrintablePlanV2({
  segments,
  raceName,
  exportDate,
  strategy,
  products,
  copy,
  locale,
  formatDistanceWithUnit,
}: PrintablePlanV2Props) {
  const printCopy = copy.sections.timeline.printViewV2;

  return (
    <div className="hidden print:block">
      <style jsx global>{`
        @media print {
          @page {
            margin: 12mm;
          }
          body {
            background: white !important;
            color: #0f172a !important;
          }
          .print-v2 * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="print-v2 space-y-4">
        <header className="rounded-lg border border-slate-200 bg-white p-4 text-slate-900 shadow-sm print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-lg font-semibold">{raceName}</p>
              <p className="text-sm text-slate-500">{printCopy.title}</p>
            </div>
            <p className="text-xs text-slate-500">
              {printCopy.exportLabel.replace("{date}", exportDate)}
            </p>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
            <p>{printCopy.strategyCarbs.replace("{amount}", Math.round(strategy.carbsPerHour).toString())}</p>
            <p>{printCopy.strategyWater.replace("{amount}", Math.round(strategy.waterMlPerHour).toString())}</p>
            <p>{printCopy.strategySodium.replace("{amount}", Math.round(strategy.sodiumMgPerHour).toString())}</p>
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-500">{printCopy.reminder}</p>
        </header>

        <div className="space-y-4">
          {segments.map((segment) => (
            <PrintableSegmentCard
              key={`${segment.from}-${segment.checkpoint}-${segment.distanceKm}`}
              segment={segment}
              pickList={buildAidStationPickList(segment, products, {
                flaskSizeMl: strategy.flaskSizeMl,
                minCoveragePercent: 0.95,
              })}
              copy={copy}
              locale={locale}
              formatDistanceWithUnit={formatDistanceWithUnit}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
