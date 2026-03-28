"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "../../../contexts/OnboardingContext";
import { useI18n } from "../../i18n-provider";
import { fuelTypeValues } from "../../../lib/fuel-types";

const FUEL_TYPE_EMOJI: Record<string, string> = {
  gel: "🟡",
  bar: "🍫",
  electrolyte: "💧",
  capsule: "💊",
  drink_mix: "🥤",
  real_food: "🍌",
  other: "➕",
};

export default function NutritionPage() {
  const router = useRouter();
  const { state, setFuelTypes } = useOnboarding();
  const { t } = useI18n();
  const [selected, setSelected] = useState<string[]>(state.fuelTypes ?? []);
  const [showError, setShowError] = useState(false);
  const toggle = (type: string) => {
    setShowError(false);
    setSelected((prev) =>
      prev.includes(type) ? prev.filter((v) => v !== type) : [...prev, type]
    );
  };

  const handleContinue = () => {
    if (selected.length === 0) {
      setShowError(true);
      return;
    }
    setFuelTypes(selected);
    router.push("/onboarding/improve");
  };

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
          Quels types de ravitaillement utilises-tu ?
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fuelTypeValues.filter((type) => type !== "other").map((type) => {
            const isSelected = selected.includes(type);
            const label = t.racePlanner.onboarding.fuelTypes[type].label;
            return (
              <button
                key={type}
                onClick={() => toggle(type)}
                className="flex flex-col items-start gap-1 rounded-2xl px-4 py-4 text-left transition-all active:scale-[0.97]"
                style={{
                  backgroundColor: isSelected ? "#ecfdf5" : "#ffffff",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  border: isSelected ? "2px solid #10b981" : "2px solid transparent",
                }}
              >
                <span className="text-2xl">{FUEL_TYPE_EMOJI[type]}</span>
                <span className="text-sm font-semibold leading-tight" style={{ color: "#1a2e0a" }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        {showError && (
          <p className="text-sm" style={{ color: "#dc2626" }}>
            Sélectionne au moins un type de ravitaillement.
          </p>
        )}
      </div>

      <div
        className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-5 pb-8 pt-4"
        style={{ backgroundColor: "#FAF7F2" }}
      >
        <button
          onClick={handleContinue}
          className="flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80"
          style={{
            backgroundColor: "#2D5016",
            opacity: selected.length === 0 ? 0.4 : 1,
          }}
        >
          Continuer
        </button>
      </div>

      <div className="h-28" />
    </div>
  );
}
