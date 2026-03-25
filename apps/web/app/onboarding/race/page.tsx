"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "../../../contexts/OnboardingContext";

export default function RacePage() {
  const router = useRouter();
  const { state, setDistance, setElevation } = useOnboarding();
  const [distanceInput, setDistanceInput] = useState(
    state.distance !== null ? String(state.distance) : ""
  );
  const [elevationInput, setElevationInput] = useState(
    state.elevation !== null ? String(state.elevation) : ""
  );

  const canContinue =
    distanceInput !== "" &&
    elevationInput !== "" &&
    Number(distanceInput) > 0 &&
    Number(elevationInput) >= 0;

  function handleContinue() {
    if (!canContinue) return;
    setDistance(Number(distanceInput));
    setElevation(Number(elevationInput));
    router.push("/onboarding/goal");
  }

  return (
    <div className="flex flex-col gap-6 pt-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold" style={{ color: "#1a2e0a" }}>
          Ta course
        </h1>
        <p className="text-sm" style={{ color: "#6b7c5a" }}>
          Renseigne les caractéristiques de ta course
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="distance"
            className="text-sm font-semibold"
            style={{ color: "#1a2e0a" }}
          >
            Distance
          </label>
          <div
            className="flex items-center overflow-hidden rounded-2xl"
            style={{
              backgroundColor: "#ffffff",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
              border: distanceInput ? "2px solid #2D5016" : "2px solid transparent",
            }}
          >
            <input
              id="distance"
              type="number"
              inputMode="numeric"
              placeholder="42"
              value={distanceInput}
              onChange={(e) => setDistanceInput(e.target.value)}
              className="h-16 flex-1 bg-transparent px-5 text-2xl font-bold outline-none placeholder:font-normal placeholder:text-gray-300"
              style={{ color: "#1a2e0a" }}
              min="1"
              max="500"
            />
            <span className="pr-5 text-base font-medium" style={{ color: "#6b7c5a" }}>
              km
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="elevation"
            className="text-sm font-semibold"
            style={{ color: "#1a2e0a" }}
          >
            Dénivelé positif
          </label>
          <div
            className="flex items-center overflow-hidden rounded-2xl"
            style={{
              backgroundColor: "#ffffff",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
              border: elevationInput ? "2px solid #2D5016" : "2px solid transparent",
            }}
          >
            <input
              id="elevation"
              type="number"
              inputMode="numeric"
              placeholder="1500"
              value={elevationInput}
              onChange={(e) => setElevationInput(e.target.value)}
              className="h-16 flex-1 bg-transparent px-5 text-2xl font-bold outline-none placeholder:font-normal placeholder:text-gray-300"
              style={{ color: "#1a2e0a" }}
              min="0"
              max="10000"
            />
            <span className="pr-5 text-base font-medium" style={{ color: "#6b7c5a" }}>
              m
            </span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-5 pb-8 pt-4"
        style={{ backgroundColor: "#FAF7F2" }}
      >
        <button
          onClick={handleContinue}
          disabled={!canContinue}
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
