"use client";

import { useRouter } from "next/navigation";
import { useOnboarding } from "../../../contexts/OnboardingContext";
import {
  calculateNutrition,
  calculateAdjustedPace,
  formatEstimatedTime,
  formatAveragePace,
} from "../../../lib/nutrition";

type FoodItem = {
  emoji: string;
  label: string;
  count: number;
};

function computeFoodMix(
  totalCarbs: number,
  gelTolerance: "well" | "varied" | "avoid" | null,
  solidFood: "banana" | "bars" | "tuc" | "dates" | null
): FoodItem[] {
  const gelCarbsPerUnit = 25;

  const gelFraction =
    gelTolerance === "well" ? 0.4 : gelTolerance === "varied" ? 0.2 : 0;

  const gelCarbs = Math.round(totalCarbs * gelFraction);
  const remainingCarbs = totalCarbs - gelCarbs;

  const items: FoodItem[] = [];

  const gelCount = Math.ceil(gelCarbs / gelCarbsPerUnit);
  if (gelCount > 0) {
    items.push({ emoji: "🧃", label: "gels", count: gelCount });
  }

  if (remainingCarbs > 0) {
    switch (solidFood) {
      case "banana": {
        const count = Math.ceil(remainingCarbs / 25);
        items.push({ emoji: "🍌", label: "bananes", count });
        break;
      }
      case "bars": {
        const count = Math.ceil(remainingCarbs / 35);
        items.push({ emoji: "🍫", label: "barres", count });
        break;
      }
      case "tuc": {
        const count = Math.ceil(remainingCarbs / 5);
        items.push({ emoji: "🥐", label: "portions TUC", count });
        break;
      }
      case "dates": {
        const count = Math.ceil(remainingCarbs / 7);
        items.push({ emoji: "🌴", label: "dattes", count });
        break;
      }
      default: {
        // fallback: bananas
        const count = Math.ceil(remainingCarbs / 25);
        items.push({ emoji: "🍌", label: "bananes", count });
        break;
      }
    }
  }

  return items;
}

export default function ImprovePage() {
  const router = useRouter();
  const { state } = useOnboarding();

  const distance = state.distance ?? 42;
  const elevation = state.elevation ?? 1500;
  const goal = state.goal ?? "comfort";

  const plan = calculateNutrition(distance, elevation, goal);
  const estimatedMinutes = distance * calculateAdjustedPace(distance, elevation, goal);
  const estimatedTime = formatEstimatedTime(distance, elevation, goal);
  const averagePace = formatAveragePace(distance, elevation, goal);

  const totalCarbs = Math.round(plan.carbsPerHour * (estimatedMinutes / 60));
  const foodItems = computeFoodMix(totalCarbs, state.gelTolerance, state.solidFood);

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
      <div className="grid grid-cols-2 gap-3">
        <div
          className="flex flex-col items-center gap-1 rounded-2xl p-4"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <span className="text-2xl">🍬</span>
          <span className="text-xl font-bold" style={{ color: "#1a2e0a" }}>
            {plan.carbsPerHour}g
          </span>
          <span className="text-center text-xs" style={{ color: "#6b7c5a" }}>
            Glucides/h
          </span>
        </div>
        <div
          className="flex flex-col items-center gap-1 rounded-2xl p-4"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <span className="text-2xl">💧</span>
          <span className="text-xl font-bold" style={{ color: "#1a2e0a" }}>
            {plan.waterPerHour}ml
          </span>
          <span className="text-center text-xs" style={{ color: "#6b7c5a" }}>
            Eau/h
          </span>
        </div>
        <div
          className="flex flex-col items-center gap-1 rounded-2xl p-4"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <span className="text-2xl">🧂</span>
          <span className="text-xl font-bold" style={{ color: "#1a2e0a" }}>
            {plan.sodiumPerHour}mg
          </span>
          <span className="text-center text-xs" style={{ color: "#6b7c5a" }}>
            Sodium/h
          </span>
        </div>
        <div
          className="flex flex-col items-center gap-1 rounded-2xl p-4"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <span className="text-2xl">⏱️</span>
          <span className="text-xl font-bold" style={{ color: "#1a2e0a" }}>
            {estimatedTime}
          </span>
          <span className="text-center text-xs" style={{ color: "#6b7c5a" }}>
            Temps estimé
          </span>
        </div>
        <div
          className="col-span-2 flex flex-col items-center gap-1 rounded-2xl p-4"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <span className="text-2xl">🏃</span>
          <span className="text-xl font-bold" style={{ color: "#1a2e0a" }}>
            {averagePace}
          </span>
          <span className="text-center text-xs" style={{ color: "#6b7c5a" }}>
            Allure moyenne
          </span>
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

        <div className="flex flex-col gap-3">
          {foodItems.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: "#1a2e0a" }}>
                {item.emoji} {item.count} {item.label}
              </span>
              <span
                className="rounded-full px-3 py-0.5 text-xs font-medium"
                style={{ backgroundColor: "#e8f0e0", color: "#2D5016" }}
              >
                {item.label === "gels"
                  ? `${item.count * 25}g glucides`
                  : item.label === "bananes"
                  ? `${item.count * 25}g glucides`
                  : item.label === "barres"
                  ? `${item.count * 35}g glucides`
                  : item.label === "portions TUC"
                  ? `${item.count * 5}g glucides`
                  : `${item.count * 7}g glucides`}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm" style={{ color: "#6b7c5a" }}>
          Ce mix couvre environ{" "}
          <span className="font-semibold" style={{ color: "#1a2e0a" }}>
            {totalCarbs}g de glucides
          </span>{" "}
          pour ta course.
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
