"use client";

import { useRouter } from "next/navigation";
import { useOnboarding } from "../../../contexts/OnboardingContext";
import type { EatingEase } from "../../../contexts/OnboardingContext";

type Option = {
  value: EatingEase;
  label: string;
  description: string;
  emoji: string;
};

const OPTIONS: Option[] = [
  {
    value: "hard",
    label: "Difficilement",
    description: "Je dois forcer pour manger en course",
    emoji: "😬",
  },
  {
    value: "ok",
    label: "Ça va",
    description: "Je mange si je me le rappelle",
    emoji: "🙂",
  },
  {
    value: "easy",
    label: "Facilement",
    description: "Je mange sans problème en courant",
    emoji: "😄",
  },
];

export default function NutritionPage() {
  const router = useRouter();
  const { state, setEatingEase } = useOnboarding();

  function handleSelect(value: EatingEase) {
    setEatingEase(value);
    setTimeout(() => {
      router.push("/onboarding/hydration");
    }, 300);
  }

  return (
    <div className="flex flex-col gap-6 pt-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold" style={{ color: "#1a2e0a" }}>
          Alimentation en course
        </h1>
        <p className="text-sm" style={{ color: "#6b7c5a" }}>
          Tu manges facilement en course ?
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {OPTIONS.map((option) => {
          const isSelected = state.eatingEase === option.value;
          return (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className="flex w-full items-center gap-4 rounded-2xl p-5 text-left transition-all active:scale-[0.98]"
              style={{
                backgroundColor: "#ffffff",
                boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                border: isSelected ? "2px solid #2D5016" : "2px solid transparent",
              }}
            >
              <span className="text-3xl">{option.emoji}</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-semibold" style={{ color: "#1a2e0a" }}>
                  {option.label}
                </span>
                <span className="text-sm" style={{ color: "#6b7c5a" }}>
                  {option.description}
                </span>
              </div>
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

      <p className="text-center text-xs" style={{ color: "#9ca3af" }}>
        Sélectionne une option pour continuer
      </p>
    </div>
  );
}
