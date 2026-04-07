"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "../../../contexts/OnboardingContext";
import { useI18n } from "../../i18n-provider";
import {
  calculateNutrition,
  calculateAdjustedPace,
  formatEstimatedTime,
  formatAveragePace,
} from "../../../lib/nutrition";
import { computeAidStationNutrition } from "../../../lib/nutrition-planner";
import { Button } from "../../../components/ui/button";
import type { FuelProduct } from "../../../lib/product-types";
import type { NutritionItem } from "../../../lib/nutrition-planner";
import { trackOnboardingEvent } from "../../../lib/google-analytics";

const FUEL_TYPE_COLOR: Record<string, string> = {
  gel: "#fbbf24",
  electrolyte: "#3b82f6",
  bar: "#f59e0b",
  capsule: "#f97316",
  drink_mix: "#06b6d4",
  real_food: "#22c55e",
  other: "#94a3b8",
};

const FUEL_TYPE_EMOJI: Record<string, string> = {
  gel: "🟡",
  drink_mix: "🔵",
  electrolyte: "💧",
  capsule: "💊",
  bar: "🍫",
  real_food: "🍌",
  other: "📦",
};

const FUEL_TYPE_WEIGHTS: Record<string, number> = {
  gel: 4,
  electrolyte: 3,
  bar: 2,
  drink_mix: 3,
  capsule: 1,
  real_food: 2,
  other: 1,
};

function computeMixPercentages(fuelTypes: string[]): Record<string, number> {
  const totalWeight = fuelTypes.reduce((sum, t) => sum + (FUEL_TYPE_WEIGHTS[t] ?? 1), 0);
  const raw = fuelTypes.map((t) => ({
    type: t,
    pct: Math.round(((FUEL_TYPE_WEIGHTS[t] ?? 1) / totalWeight) * 100),
  }));
  const diff = 100 - raw.reduce((s, r) => s + r.pct, 0);
  if (raw.length > 0) raw[0].pct += diff;
  return Object.fromEntries(raw.map((r) => [r.type, r.pct]));
}

export default function ImprovePage() {
  const router = useRouter();
  const { state, setComputedNutrition } = useOnboarding();
  const { t } = useI18n();
  const aidStationCopy = t.racePlanner.onboarding.improve.aidStationPreview;

  const [products, setProducts] = useState<FuelProduct[]>([]);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.products)) setProducts(data.products as FuelProduct[]);
      })
      .catch(() => {});
  }, []);

  const distance = state.distance ?? 42;
  const elevation = state.elevation ?? 1500;
  const goal = state.goal ?? "comfort";

  const plan = calculateNutrition(distance, elevation, goal);
  const estimatedTime = formatEstimatedTime(distance, elevation, goal);
  const averagePace = formatAveragePace(distance, elevation, goal);

  const paceMinPerKm = calculateAdjustedPace(distance, elevation, goal);
  const speedKph = 60 / paceMinPerKm;
  const rawAidStations = (state.checkpoints ?? []).map((cp) => ({
    name: cp.name,
    distanceKm: cp.km,
  }));

  // Each display station carries nutrition for the segment FROM it to the next.
  // The planner computes backward-looking segments (prev→current), so we pass
  // [...rawAidStations, finish] and shift: display[i] gets plannerOutput[i].
  //   display[0] = start  → plannerOutput[0] = first ravito (0 → ravito1)
  //   display[i] = ravito_i → plannerOutput[i] = ravito_{i+1} (ravito_i → ravito_{i+1})
  //   display[last] = last ravito → plannerOutput[last] = finish (last → end)
  const startStation = { name: t.racePlanner.onboarding.improve.startLabel, distanceKm: 0 };
  const finishStation = { name: "finish", distanceKm: distance };
  const plannerStations = [...rawAidStations, finishStation];
  const displayList = [startStation, ...rawAidStations];

  const plannerOutput =
    state.fuelTypes.length > 0
      ? computeAidStationNutrition(
          plannerStations,
          state.fuelTypes,
          plan.carbsPerHour,
          speedKph,
          products,
          FUEL_TYPE_WEIGHTS,
          plan.sodiumPerHour,
          plan.waterPerHour,
        )
      : [];

  const allStationsWithNutrition = state.fuelTypes.length > 0
    ? displayList.map((station, i) => ({
        ...station,
        nutrition: plannerOutput[i]?.nutrition ?? [],
      }))
    : [];
  const PREVIEW_COUNT = 3;
  const previewStations = allStationsWithNutrition.slice(0, PREVIEW_COUNT);
  const hiddenCount = allStationsWithNutrition.length - PREVIEW_COUNT;

  const mixPercentages = useMemo(
    () => computeMixPercentages(state.fuelTypes),
    [state.fuelTypes],
  );

  // planSummary kept for potential future use but not rendered in "Ton plan alimentaire"
  const _planSummary = useMemo(() => {
    const acc: Record<string, NutritionItem & { quantity: number; carbsG: number; sodiumMg: number }> = {};
    for (const station of allStationsWithNutrition) {
      for (const item of station.nutrition ?? []) {
        if (!acc[item.fuelType]) {
          acc[item.fuelType] = { ...item, quantity: 0, carbsG: 0, sodiumMg: 0 };
        }
        acc[item.fuelType].quantity += Math.ceil(item.quantity);
        acc[item.fuelType].carbsG += item.carbsG;
        acc[item.fuelType].sodiumMg += (item as NutritionItem & { sodiumMg?: number }).sodiumMg ?? 0;
      }
    }
    return Object.values(acc);
  }, [allStationsWithNutrition]);

  function handleCTA() {
    trackOnboardingEvent("action", {
      action: "improve_continue_account",
      fuel_type_count: state.fuelTypes.length,
      fuel_types: state.fuelTypes.join(","),
      hidden_station_count: hiddenCount,
      preview_station_count: previewStations.length,
      station_count: allStationsWithNutrition.length,
      step_name: "improve",
    });
    setComputedNutrition(
      allStationsWithNutrition.map((s) => ({
        name: s.name,
        distanceKm: s.distanceKm,
        nutrition: (s.nutrition ?? []).map((n) => ({
          fuelType: n.fuelType,
          productId: n.productId,
          productName: n.productName,
          quantity: n.quantity,
          carbsG: n.carbsG,
        })),
      })),
    );
    router.push("/onboarding/account");
  }

  return (
    <div className="flex flex-col gap-5 px-6 pt-10 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold" style={{ color: "#1a2e0a" }}>
          Ton plan détaillé 🍃
        </h1>
        <p className="text-sm" style={{ color: "#6b7c5a" }}>
          {distance} km · {elevation} m D+
        </p>
      </div>

      {/* 1 — Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <span className="text-base">🍬</span>
          <span className="text-sm font-bold" style={{ color: "#1a2e0a" }}>{plan.carbsPerHour}g</span>
          <span className="text-xs" style={{ color: "#6b7c5a" }}>Glucides/h</span>
        </div>
        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <span className="text-base">💧</span>
          <span className="text-sm font-bold" style={{ color: "#1a2e0a" }}>{plan.waterPerHour}ml</span>
          <span className="text-xs" style={{ color: "#6b7c5a" }}>Eau/h</span>
        </div>
        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <span className="text-base">🧂</span>
          <span className="text-sm font-bold" style={{ color: "#1a2e0a" }}>{plan.sodiumPerHour}mg</span>
          <span className="text-xs" style={{ color: "#6b7c5a" }}>Sodium/h</span>
        </div>
        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <span className="text-base">⏱️</span>
          <span className="text-sm font-bold" style={{ color: "#1a2e0a" }}>{estimatedTime}</span>
          <span className="text-xs" style={{ color: "#6b7c5a" }}>Temps estimé</span>
        </div>
        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <span className="text-base">🏃</span>
          <span className="text-sm font-bold" style={{ color: "#1a2e0a" }}>{averagePace}</span>
          <span className="text-xs" style={{ color: "#6b7c5a" }}>Allure moyenne</span>
        </div>
      </div>

      {/* 2 — Ton mix nutritionnel */}
      {state.fuelTypes.length > 0 && (
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <h2 className="mb-3 text-base font-semibold" style={{ color: "#1a2e0a" }}>
            {t.racePlanner.onboarding.improve.nutritionMix.title}
          </h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {state.fuelTypes.map((type) => (
              <span
                key={type}
                className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: FUEL_TYPE_COLOR[type] ?? "#94a3b8" }}
              >
                {FUEL_TYPE_EMOJI[type] ?? "📦"}{" "}
                {t.racePlanner.onboarding.fuelTypes[type as keyof typeof t.racePlanner.onboarding.fuelTypes]?.label ?? type}{" "}
                {mixPercentages[type] ?? 0}%
              </span>
            ))}
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            {state.fuelTypes.map((type) => (
              <div
                key={type}
                style={{
                  width: `${mixPercentages[type] ?? 0}%`,
                  backgroundColor: FUEL_TYPE_COLOR[type] ?? "#94a3b8",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 3 — Tes premiers ravitaillements */}
      {previewStations.length > 0 && (
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <h2 className="mb-0.5 text-base font-semibold" style={{ color: "#1a2e0a" }}>
            {aidStationCopy.title}
          </h2>
          <p className="mb-2 text-xs" style={{ color: "#6b7c5a" }}>
            {aidStationCopy.subtitle}
          </p>
          {previewStations.map((station, i) => (
            <div
              key={i}
              className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: "#374151" }}>
                  {station.name} · {Math.round(station.distanceKm)}km
                </span>
                <span className="text-sm text-muted-foreground">
                  ≈{Math.round((station.nutrition ?? []).reduce((sum, n) => sum + n.carbsG, 0))}g
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {(station.nutrition ?? []).map((item) => (
                  <span
                    key={item.fuelType}
                    className="flex items-center gap-1 text-sm"
                    style={{ color: "#1a2e0a" }}
                  >
                    {FUEL_TYPE_EMOJI[item.fuelType] ?? "📦"} {item.productName} ×{Math.ceil(item.quantity)}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {hiddenCount > 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/40 p-5 text-center">
              <p className="mb-3 text-sm text-foreground">
                🔒 {t.racePlanner.onboarding.improve.hiddenRavitos.replace("{count}", String(hiddenCount))}
              </p>
              <Button variant="outline" onClick={handleCTA}>
                {t.racePlanner.onboarding.improve.createAccount}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-5 pb-8 pt-4"
        style={{ backgroundColor: "#FAF7F2" }}
      >
        <button
          onClick={handleCTA}
          className="flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80"
          style={{ backgroundColor: "#2D5016" }}
        >
          Tu veux savoir quand manger tout ça ? 🗓️
        </button>
      </div>

      <div className="h-28" />
    </div>
  );
}
