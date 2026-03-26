"use client";

import { useRouter } from "next/navigation";
import { useOnboarding } from "../../../contexts/OnboardingContext";
import type { AidAccess } from "../../../contexts/OnboardingContext";

type Option = {
  value: AidAccess;
  label: string;
  description: string;
  emoji: string;
};

const OPTIONS: Option[] = [
  {
    value: "full",
    label: "Oui, ravitos complets",
    description: "Tout est fourni sur le parcours",
    emoji: "🏪",
  },
  {
    value: "limited",
    label: "Ravitos limités",
    description: "Quelques points d'eau seulement",
    emoji: "💧",
  },
  {
    value: "autonomous",
    label: "Je suis autonome",
    description: "Je porte tout sur moi",
    emoji: "🎒",
  },
];

export default function HydrationPage() {
  const router = useRouter();
  const { state, setAidAccess } = useOnboarding();

  function handleContinue() {
    router.push("/onboarding/loading");
  }

  return (
    <div className="flex flex-col gap-6 px-6 pt-10 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold" style={{ color: "#1a2e0a" }}>
          Accès aux ravitaillements
        </h1>
        <p className="text-sm" style={{ color: "#6b7c5a" }}>
          Qu&apos;est-ce qui t&apos;est disponible sur le parcours ?
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {OPTIONS.map((option) => {
          const isSelected = state.aidAccess === option.value;
          return (
            <button
              key={option.value}
              onClick={() => setAidAccess(option.value)}
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

      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-5 pb-8 pt-4"
        style={{ backgroundColor: "#FAF7F2" }}
      >
        <button
          onClick={handleContinue}
          disabled={!state.aidAccess}
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
