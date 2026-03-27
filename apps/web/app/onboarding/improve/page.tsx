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
import type { FuelProduct } from "../../../lib/product-types";
import type { NutritionItem } from "../../../lib/nutrition-planner";

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


export default function ImprovePage() {
  const router = useRouter();
  const { state } = useOnboarding();
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
  const estimatedMinutes = distance * calculateAdjustedPace(distance, elevation, goal);
  const estimatedTime = formatEstimatedTime(distance, elevation, goal);
  const averagePace = formatAveragePace(distance, elevation, goal);

  const paceMinPerKm = calculateAdjustedPace(distance, elevation, goal);
  const speedKph = 60 / paceMinPerKm;
  const rawAidStations = (state.checkpoints ?? []).map((cp) => ({
    name: cp.name,
    distanceKm: cp.km,
  }));
  const allStationsWithNutrition =
    state.fuelTypes.length > 0 && rawAidStations.length > 0
      ? computeAidStationNutrition(
          rawAidStations,
          state.fuelTypes,
          plan.carbsPerHour,
          speedKph,
          products,
        )
      : [];
  const previewStations = allStationsWithNutrition.slice(0, 5);

  const planSummary = useMemo(() => {
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
  const planTotalCarbs = Math.round(planSummary.reduce((s, n) => s + n.carbsG, 0));

  function handleCTA() {
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

      {/* Metric cards */}
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

      {/* Food mix section */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
      >
        <h2 className="mb-4 text-base font-semibold" style={{ color: "#1a2e0a" }}>
          Ton plan alimentaire
        </h2>

        <div className="flex flex-wrap gap-2">
          {planSummary.map((item) => (
            <span
              key={item.fuelType}
              className="rounded-full bg-slate-100 px-3 py-1 text-sm"
              style={{ color: "#1a2e0a" }}
            >
              {FUEL_TYPE_EMOJI[item.fuelType] ?? "📦"}{" "}
              {Math.ceil(item.quantity)}{" "}
              {t.racePlanner.onboarding.fuelTypes[item.fuelType as keyof typeof t.racePlanner.onboarding.fuelTypes]?.label ?? item.fuelType}{" "}
              · {Math.round(item.carbsG)}g
            </span>
          ))}
        </div>

        <p className="mt-2 text-xs" style={{ color: "#6b7c5a" }}>
          Total : {planTotalCarbs}g glucides · {plan.sodiumPerHour}mg sodium/h · {plan.waterPerHour}ml eau/h
        </p>

        {state.aidAccess === "autonomous" && (
          <div
            className="mt-3 rounded-xl px-4 py-3 text-sm"
            style={{ backgroundColor: "#fef9c3", color: "#854d0e" }}
          >
            🎒 Tu es autonome — pense à tout emporter avec toi dès le départ.
          </div>
        )}
      </div>

      {/* Aid station preview */}
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
              className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0"
            >
              <span
                className="w-32 shrink-0 truncate text-sm font-semibold"
                style={{ color: "#374151" }}
              >
                {station.name} · {Math.round(station.distanceKm)}km
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(station.nutrition ?? []).map((item) => (
                  <span
                    key={item.fuelType}
                    title={item.productName}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs"
                    style={{ color: "#1a2e0a" }}
                  >
                    {FUEL_TYPE_EMOJI[item.fuelType] ?? "📦"}{" "}
                    {item.productName.length > 20 ? item.productName.slice(0, 20) + "…" : item.productName}{" "}
                    ×{Math.ceil(item.quantity)}
                  </span>
                ))}
              </div>
              <span className="ml-auto shrink-0 text-xs" style={{ color: "#9ca3af" }}>
                ≈{Math.round((station.nutrition ?? []).reduce((sum, n) => sum + n.carbsG, 0))}g
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Section A — Nutrition mix */}
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
                {Math.round(100 / state.fuelTypes.length)}%
              </span>
            ))}
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            {state.fuelTypes.map((type) => (
              <div
                key={type}
                style={{
                  width: `${100 / state.fuelTypes.length}%`,
                  backgroundColor: FUEL_TYPE_COLOR[type] ?? "#94a3b8",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Section B — First 5 aid stations */}
      {previewStations.length > 0 && (
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <h2 className="mb-0.5 text-base font-semibold" style={{ color: "#1a2e0a" }}>
            {t.racePlanner.onboarding.improve.aidStationPreview.title}
          </h2>
          <p className="mb-2 text-xs" style={{ color: "#6b7c5a" }}>
            {t.racePlanner.onboarding.improve.aidStationPreview.subtitle}
          </p>
          {previewStations.map((station, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0"
            >
              <span
                className="w-32 shrink-0 truncate text-sm font-semibold"
                style={{ color: "#374151" }}
              >
                Ravito {i + 1} · {Math.round(station.distanceKm)}km
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(station.nutrition ?? []).map((item) => (
                  <span
                    key={item.fuelType}
                    title={item.productName}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs"
                    style={{ color: "#1a2e0a" }}
                  >
                    {FUEL_TYPE_EMOJI[item.fuelType] ?? "📦"}{" "}
                    {item.productName.length > 20 ? item.productName.slice(0, 20) + "…" : item.productName}{" "}
                    ×{Math.ceil(item.quantity)}
                  </span>
                ))}
              </div>
              <span className="ml-auto shrink-0 text-xs" style={{ color: "#9ca3af" }}>
                ≈{Math.round((station.nutrition ?? []).reduce((sum, n) => sum + n.carbsG, 0))}g
              </span>
            </div>
          ))}
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
