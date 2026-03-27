"use client";

import React, { createContext, useContext, useState } from "react";

export type Goal = "comfort" | "good_time" | "performance";
export type EatingEase = "hard" | "ok" | "easy";
export type SweatLevel = "a_lot" | "normal" | "little";
export type AidAccess = "full" | "limited" | "autonomous";

export type RaceCheckpoint = {
  km: number;
  name: string;
  type?: "ravito" | "checkpoint";
};

export type OnboardingElevationPoint = { distanceKm: number; elevationM: number };

export type ComputedNutritionItem = {
  fuelType: string;
  productId: string;
  productName: string;
  quantity: number;
  carbsG: number;
};

export type ComputedStation = {
  name: string;
  distanceKm: number;
  nutrition: ComputedNutritionItem[];
};

export type OnboardingState = {
  distance: number | null;
  elevation: number | null;
  goal: Goal | null;
  eatingEase: EatingEase | null;
  sweatLevel: SweatLevel | null;
  aidAccess: AidAccess | null;
  fuelTypes: string[];
  computedNutrition: ComputedStation[];
  raceId: string | null;
  checkpoints: RaceCheckpoint[] | null;
  elevationProfile: OnboardingElevationPoint[] | null;
};

type OnboardingContextType = {
  state: OnboardingState;
  setDistance: (v: number) => void;
  setElevation: (v: number) => void;
  setGoal: (v: Goal) => void;
  setEatingEase: (v: EatingEase) => void;
  setSweatLevel: (v: SweatLevel) => void;
  setAidAccess: (v: AidAccess) => void;
  setFuelTypes: (v: string[]) => void;
  setComputedNutrition: (v: ComputedStation[]) => void;
  setRaceSelection: (raceId: string, distanceKm: number, elevationM: number, checkpoints: RaceCheckpoint[]) => void;
  clearRaceSelection: () => void;
  setElevationProfile: (v: OnboardingElevationPoint[]) => void;
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState>({
    distance: null,
    elevation: null,
    goal: null,
    eatingEase: null,
    sweatLevel: null,
    aidAccess: null,
    fuelTypes: [],
    computedNutrition: [],
    raceId: null,
    checkpoints: null,
    elevationProfile: null,
  });

  return (
    <OnboardingContext.Provider
      value={{
        state,
        setDistance: (v) => setState((s) => ({ ...s, distance: v })),
        setElevation: (v) => setState((s) => ({ ...s, elevation: v })),
        setGoal: (v) => setState((s) => ({ ...s, goal: v })),
        setEatingEase: (v) => setState((s) => ({ ...s, eatingEase: v })),
        setSweatLevel: (v) => setState((s) => ({ ...s, sweatLevel: v })),
        setAidAccess: (v) => setState((s) => ({ ...s, aidAccess: v })),
        setFuelTypes: (v) => setState((s) => ({ ...s, fuelTypes: v })),
        setComputedNutrition: (v) => setState((s) => ({ ...s, computedNutrition: v })),
        setRaceSelection: (raceId, distanceKm, elevationM, checkpoints) =>
          setState((s) => ({
            ...s,
            raceId,
            distance: distanceKm,
            elevation: elevationM,
            checkpoints,
          })),
        clearRaceSelection: () =>
          setState((s) => ({
            ...s,
            raceId: null,
            checkpoints: null,
            elevationProfile: null,
          })),
        setElevationProfile: (v) => setState((s) => ({ ...s, elevationProfile: v })),
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextType {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
