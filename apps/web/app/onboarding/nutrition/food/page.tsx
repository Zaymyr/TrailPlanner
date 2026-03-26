"use client";

import { useRouter } from "next/navigation";
import { useOnboarding } from "../../../../contexts/OnboardingContext";
import type { SolidFood } from "../../../../contexts/OnboardingContext";

type FoodOption = {
  value: SolidFood;
  label: string;
  emoji: string;
};

const FOOD_OPTIONS: FoodOption[] = [
  { value: "banana", label: "Banane", emoji: "🍌" },
  { value: "bars", label: "Barres", emoji: "🍫" },
  { value: "tuc", label: "TUC / biscuits salés", emoji: "🥐" },
  { value: "dates", label: "Dattes", emoji: "🌴" },
];

export default function NutritionFoodPage() {
  const router = useRouter();
  const { state, setSolidFood } = useOnboarding();

  return (
    <div className="flex flex-col gap-6 px-6 pt-10 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold" style={{ color: "#1a2e0a" }}>
          Tes préférences alimentaires
        </h1>
        <p className="text-sm" style={{ color: "#6b7c5a" }}>
          Pour personnaliser ton plan ravito
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold" style={{ color: "#1a2e0a" }}>
          Ton aliment solide préféré en course ?
        </p>
        <div className="flex flex-col gap-2">
          {FOOD_OPTIONS.map((option) => {
            const isSelected = state.solidFood === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setSolidFood(option.value)}
                className="flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: "#ffffff",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  border: isSelected ? "2px solid #2D5016" : "2px solid transparent",
                }}
              >
                <span className="text-2xl">{option.emoji}</span>
                <span className="text-base font-medium" style={{ color: "#1a2e0a" }}>
                  {option.label}
                </span>
                {isSelected && (
                  <div
                    className="ml-auto flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: "#2D5016" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6L5 9L10 3"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-5 pb-8 pt-4"
        style={{ backgroundColor: "#FAF7F2" }}
      >
        <button
          onClick={() => router.push("/onboarding/improve")}
          disabled={!state.solidFood}
          className="flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
          style={{ backgroundColor: "#2D5016" }}
        >
          Continuer
        </button>
      </div>

      <div className="h-28" />
    </div>
  );
}
