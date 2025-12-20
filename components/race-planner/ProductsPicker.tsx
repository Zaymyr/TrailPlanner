"use client";

import type { RacePlannerTranslations } from "../../locales/types";
import { MetricCard } from "../ui/MetricCard";
import { SectionHeader } from "../ui/SectionHeader";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";

export type ProductOption = {
  slug: string;
  name: string;
  carbs: number;
  sodium: number;
  servings: number;
};

type ProductsPickerProps = {
  copy: RacePlannerTranslations["sections"]["gels"];
  products: ProductOption[];
  selectedProducts: string[];
  onToggleProduct: (product: ProductOption) => void;
  onViewProduct: (product: ProductOption) => void;
};

export function ProductsPicker({
  copy,
  products,
  selectedProducts,
  onToggleProduct,
  onViewProduct,
}: ProductsPickerProps) {
  return (
    <Card>
      <CardHeader className="space-y-3 pb-0">
        <SectionHeader title={copy.title} description={copy.description} />
      </CardHeader>
      <CardContent className="space-y-4">
        {products.length === 0 ? (
          <p className="text-sm text-slate-400">{copy.empty}</p>
        ) : (
          <div className="space-y-3">
          {products.map((product) => {
            const servingsNeeded = Math.max(product.servings, 0);
            const isSelected = selectedProducts.includes(product.slug);
            const nutritionCopy = copy.nutrition
              .replace("{carbs}", product.carbs.toString())
              .replace("{sodium}", product.sodium.toString());
            const servingsCopy = copy.countLabel.replace("{count}", servingsNeeded.toString());

              return (
                <div
                  key={product.slug}
                  className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                >
                  <MetricCard
                    label={product.name}
                    value={servingsCopy}
                    helper={nutritionCopy}
                    className="border-0 bg-transparent p-0"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className="h-9 px-3 text-sm"
                      onClick={() => onToggleProduct(product)}
                    >
                      {isSelected ? "Remove from plan" : "Add to plan"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => onViewProduct(product)}
                      className="text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
                    >
                      {copy.linkLabel}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
