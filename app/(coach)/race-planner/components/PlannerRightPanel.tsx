"use client";

import type { DragEvent } from "react";
import type { RacePlannerTranslations } from "../../../../locales/types";
import type { StoredProductPreference } from "../../../../lib/product-preferences";
import type { FuelProductEstimate } from "../utils/nutrition";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { PlanManager, type PlanManagerProps } from "../../../../components/race-planner/PlanManager";

type PlannerRightPanelProps = {
  copy: RacePlannerTranslations;
  activeTab: "fuel" | "account";
  onTabChange: (tab: "fuel" | "account") => void;
  fuelProducts: FuelProductEstimate[];
  favoriteProducts: StoredProductPreference[];
  isFuelLoading: boolean;
  planManagerProps: PlanManagerProps;
};

const getNutritionCopy = (copy: RacePlannerTranslations["sections"]["gels"], product: FuelProductEstimate) =>
  copy.nutrition
    .replace("{carbs}", product.carbsGrams.toFixed(0))
    .replace("{sodium}", (product.sodiumMg ?? 0).toFixed(0));

const getCountCopy = (copy: RacePlannerTranslations["sections"]["gels"], product: FuelProductEstimate) =>
  copy.countLabel.replace("{count}", Math.max(product.count, 0).toString());

export function PlannerRightPanel({
  copy,
  activeTab,
  onTabChange,
  fuelProducts,
  favoriteProducts,
  isFuelLoading,
  planManagerProps,
}: PlannerRightPanelProps) {
  const favoriteIds = new Set(favoriteProducts.map((product) => product.id));
  const favoriteSlugs = new Set(favoriteProducts.map((product) => product.slug));
  const favoriteFuelProducts = fuelProducts.filter(
    (product) => favoriteIds.has(product.id) || favoriteSlugs.has(product.slug)
  );
  const otherFuelProducts = fuelProducts.filter(
    (product) => !favoriteIds.has(product.id) && !favoriteSlugs.has(product.slug)
  );
  const gelsCopy = copy.sections.gels;

  const handleDragStart = (event: DragEvent<HTMLDivElement>, product: FuelProductEstimate) => {
    event.dataTransfer.setData("text/trailplanner-product-id", product.id);
    event.dataTransfer.setData("text/trailplanner-product-qty", "1");
    event.dataTransfer.effectAllowed = "copy";
  };

  const renderFuelProduct = (product: FuelProductEstimate) => (
    <div
      key={product.id}
      className="space-y-3 rounded-lg border border-border bg-card p-3 shadow-sm transition hover:border-emerald-400/50 hover:bg-emerald-500/5 dark:border-slate-800 dark:bg-slate-900/60"
      draggable
      onDragStart={(event) => handleDragStart(event, product)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground dark:text-slate-50">{product.name}</p>
          <p className="text-xs text-muted-foreground dark:text-slate-300">{getNutritionCopy(gelsCopy, product)}</p>
        </div>
        <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200">
          {getCountCopy(gelsCopy, product)}
        </span>
      </div>
      {product.productUrl ? (
        <div className="flex items-center justify-end text-xs text-muted-foreground dark:text-slate-400">
          <a
            href={product.productUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[hsl(var(--success))] transition hover:text-[hsl(var(--brand))] dark:text-emerald-300 dark:hover:text-emerald-200"
          >
            {gelsCopy.linkLabel}
          </a>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-2 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="grid grid-cols-2 gap-2" role="tablist" aria-label={gelsCopy.title}>
          {(
            [
              { key: "fuel", label: gelsCopy.title },
              { key: "account", label: copy.account.title },
            ] satisfies { key: "fuel" | "account"; label: string }[]
          ).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Button
                key={tab.key}
                type="button"
                role="tab"
                variant={isActive ? "default" : "outline"}
                className="w-full justify-center"
                aria-selected={isActive}
                onClick={() => onTabChange(tab.key)}
              >
                {tab.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className={activeTab === "fuel" ? "space-y-4" : "hidden"} role="tabpanel">
        <Card>
          <CardHeader className="space-y-2 pb-3">
            <CardTitle className="text-base font-semibold">{gelsCopy.title}</CardTitle>
            <p className="text-sm text-muted-foreground dark:text-slate-300">{gelsCopy.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {isFuelLoading ? (
              <p className="text-sm text-muted-foreground dark:text-slate-400">{gelsCopy.loading}</p>
            ) : fuelProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground dark:text-slate-400">{gelsCopy.empty}</p>
            ) : (
              <div className="space-y-4">
                {favoriteFuelProducts.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-400">
                      {gelsCopy.favoritesTitle}
                    </p>
                    <div className="space-y-3">{favoriteFuelProducts.map(renderFuelProduct)}</div>
                  </div>
                ) : null}
                {otherFuelProducts.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-400">
                      {favoriteFuelProducts.length > 0 ? gelsCopy.allProductsTitle : gelsCopy.title}
                    </p>
                    <div className="space-y-3">{otherFuelProducts.map(renderFuelProduct)}</div>
                  </div>
                ) : null}
              </div>
            )}
            <p className="text-xs text-muted-foreground dark:text-slate-400">{gelsCopy.settingsHint}</p>
          </CardContent>
        </Card>
      </div>

      <div className={activeTab === "account" ? "space-y-4" : "hidden"} role="tabpanel">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{copy.account.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <PlanManager {...planManagerProps} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
