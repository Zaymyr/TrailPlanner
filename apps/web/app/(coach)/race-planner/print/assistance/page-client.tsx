"use client";

import { useMemo } from "react";
import { PrintAidStationsAssistance } from "../../../../../components/print/PrintAidStationsAssistance";
import { defaultFuelProducts } from "../../../../../lib/default-products";
import { buildPrintAidStationCards } from "../../../../../lib/print/aidStations";
import { readSelectedProducts } from "../../../../../lib/product-preferences";
import { readRacePlannerStorage } from "../../../../../lib/race-planner-storage";
import type { FuelProduct } from "../../../../../lib/product-types";
import { useI18n } from "../../../../i18n-provider";
import type { ElevationPoint, FormValues } from "../../types";
import { sanitizeElevationProfile, sanitizePlannerValues } from "../../utils/plan-sanitizers";
import { buildSegments } from "../../utils/segments";

export function AssistancePrintClientPage() {
  const { t } = useI18n();

  const payload = useMemo(() => {
    const stored = readRacePlannerStorage<Partial<FormValues>, ElevationPoint[]>();
    const values = sanitizePlannerValues(stored?.values);
    if (!values) return null;

    const normalizedValues: FormValues = {
      raceDistanceKm: values.raceDistanceKm ?? 50,
      elevationGain: values.elevationGain ?? 0,
      paceType: values.paceType ?? "pace",
      paceMinutes: values.paceMinutes ?? 6,
      paceSeconds: values.paceSeconds ?? 0,
      speedKph: values.speedKph ?? 10,
      targetIntakePerHour: values.targetIntakePerHour ?? 70,
      waterIntakePerHour: values.waterIntakePerHour ?? 500,
      sodiumIntakePerHour: values.sodiumIntakePerHour ?? 600,
      waterBagLiters: values.waterBagLiters ?? 1,
      aidStations: values.aidStations ?? [],
      startSupplies: values.startSupplies,
      finishPlan: values.finishPlan,
      segments: values.segments,
      sectionSegments: values.sectionSegments,
    };

    const segments = buildSegments(
      normalizedValues,
      t.racePlanner.defaults.start,
      t.racePlanner.defaults.finish,
      sanitizeElevationProfile(stored?.elevationProfile)
    );

    const selectedProducts = readSelectedProducts().map<FuelProduct>((item) => ({
      id: item.id,
      slug: item.slug,
      sku: item.sku,
      name: item.name,
      fuelType: "other",
      caloriesKcal: item.caloriesKcal ?? 0,
      carbsGrams: item.carbsGrams,
      sodiumMg: item.sodiumMg ?? 0,
      proteinGrams: 0,
      fatGrams: 0,
      waterMl: 0,
      productUrl: item.productUrl,
    }));

    const cards = buildPrintAidStationCards(dedupeSegments(segments), dedupeProducts([...defaultFuelProducts, ...selectedProducts]), {
      defaultWindowMinutes: 15,
      flaskSizeMl: 500,
    });

    return {
      cards,
      raceName: `${normalizedValues.raceDistanceKm.toFixed(0)} km race`,
    };
  }, [t.racePlanner.defaults.finish, t.racePlanner.defaults.start]);

  if (!payload) {
    return <div className="p-6 text-sm text-slate-700">No plan available to print.</div>;
  }

  return <PrintAidStationsAssistance raceName={payload.raceName} cards={payload.cards} />;
}

function dedupeProducts(products: FuelProduct[]): FuelProduct[] {
  const map = new Map<string, FuelProduct>();
  products.forEach((product) => {
    if (!map.has(product.id)) map.set(product.id, product);
  });
  return Array.from(map.values());
}

function dedupeSegments(segments: ReturnType<typeof buildSegments>) {
  return segments.filter((segment, index, arr) => index === arr.findIndex((item) => item.checkpoint === segment.checkpoint && item.distanceKm === segment.distanceKm));
}
