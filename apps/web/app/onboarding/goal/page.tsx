"use client";

import { useRouter } from "next/navigation";
import { useOnboarding } from "../../../contexts/OnboardingContext";
import type { Goal } from "../../../contexts/OnboardingContext";

type GoalOption = {
  value: Goal;
  label: string;
  description: string;
  emoji: string;
};

const GOALS: GoalOption[] = [
  {
    value: "comfort",
    label: "Finir confortablement",
    description: "Arriver souriant, sans se faire mal",
    emoji: "😊",
  },
  {
    value: "good_time",
    label: "Faire un bon temps",
    description: "Pousser sans se cramer",
    emoji: "⏱️",
  },
  {
    value: "performance",
    label: "Performance max",
    description: "Tout donner, repousser ses limites",
    emoji: "🔥",
  },
];

export default function GoalPage() {
  const router = useRouter();
  const { state, setGoal } = useOnboarding();

  function handleSelect(value: Goal) {
    setGoal(value);
    router.push("/onboarding/loading");
  }

  return (
    <div className="flex flex-col gap-6 pt-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold" style={{ color: "#1a2e0a" }}>
          Ton objectif
        </h1>
        <p className="text-sm" style={{ color: "#6b7c5a" }}>
          Ça va définir l&apos;intensité de ton plan
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {GOALS.map((goal) => {
          const isSelected = state.goal === goal.value;
          return (
            <button
              key={goal.value}
              onClick={() => handleSelect(goal.value)}
              className="flex w-full items-center gap-4 rounded-2xl p-5 text-left transition-all active:scale-[0.98]"
              style={{
                backgroundColor: "#ffffff",
                boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                border: isSelected ? "2px solid #2D5016" : "2px solid transparent",
              }}
            >
              <span className="text-3xl">{goal.emoji}</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-semibold" style={{ color: "#1a2e0a" }}>
                  {goal.label}
                </span>
                <span className="text-sm" style={{ color: "#6b7c5a" }}>
                  {goal.description}
                </span>
              </div>
              {isSelected && (
                <div className="ml-auto flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
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

      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-5 pb-8 pt-4"
        style={{ backgroundColor: "#FAF7F2" }}
      >
        <button
          onClick={() => state.goal && router.push("/onboarding/loading")}
          disabled={!state.goal}
          className="flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
          style={{ backgroundColor: "#2D5016" }}
        >
          Générer mon plan
        </button>
      </div>

      <div className="h-28" />
    </div>
  );
}
