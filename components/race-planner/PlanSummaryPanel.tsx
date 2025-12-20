"use client";

import Link from "next/link";
import type { RacePlannerTranslations } from "../../locales/types";
import type { RaceTotals } from "../../app/(coach)/race-planner/hooks/useRacePlanner";
import type { FuelProduct } from "../../lib/product-types";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { CommandCenter } from "./CommandCenter";
import { SectionHeader } from "../ui/SectionHeader";

export type ProductEstimate = FuelProduct & { count: number };

type PlanSummaryPanelProps = {
  copy: RacePlannerTranslations;
  totals: RaceTotals | null;
  intakeTargets: {
    carbsPerHour?: number | null;
    waterPerHour?: number | null;
    sodiumPerHour?: number | null;
  } | null;
  productEstimates: ProductEstimate[];
  isUsingCustomProducts: boolean;
  formatDuration: (minutes: number) => string;
  settingsLabel: string;
  onViewProduct: (product: { slug: string; name: string }) => void;
};

export function PlanSummaryPanel({
  copy,
  totals,
  intakeTargets,
  productEstimates,
  isUsingCustomProducts,
  formatDuration,
  settingsLabel,
  onViewProduct,
}: PlanSummaryPanelProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CommandCenter totals={totals} targets={intakeTargets} copy={copy} formatDuration={formatDuration} />

      <Card>
        <CardHeader className="space-y-0">
          <SectionHeader
            title={copy.sections.gels.title}
            description={copy.sections.gels.description}
            action={null}
          />
        </CardHeader>
        <CardContent>
          <div className="mb-4 text-sm text-slate-400">
            {isUsingCustomProducts ? (
              <p>{copy.sections.gels.usingCustom}</p>
            ) : (
              <p className="flex flex-wrap items-center gap-1">
                <span>{copy.sections.gels.settingsHint}</span>
                <Link href="/settings" className="font-semibold text-emerald-300 transition hover:text-emerald-200">
                  {settingsLabel}
                </Link>
              </p>
            )}
          </div>
          {!totals ? (
            <p className="text-sm text-slate-400">{copy.sections.gels.empty}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {productEstimates.map((product) => (
                <div key={product.id} className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-50">{product.name}</p>
                      <p className="text-sm text-slate-400">
                        {copy.sections.gels.nutrition
                          .replace("{carbs}", product.carbsGrams.toString())
                          .replace("{sodium}", product.sodiumMg.toString())}
                      </p>
                    </div>
                    <Button
                      variant="link"
                      type="button"
                      className="px-0 text-sm font-medium text-emerald-300 hover:text-emerald-200"
                      onClick={() => onViewProduct({ slug: product.slug, name: product.name })}
                    >
                      {copy.sections.gels.linkLabel}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-200">
                    <p>
                      {copy.sections.gels.countLabel.replace("{count}", Math.max(product.count, 0).toString())}
                    </p>
                    <p className="text-xs text-slate-500">{product.carbsGrams} g</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
