"use client";

import React, { createContext, useContext, useState } from "react";

export type Goal = "comfort" | "good_time" | "performance";
export type EatingEase = "hard" | "ok" | "easy";
export type SweatLevel = "a_lot" | "normal" | "little";

export type RaceCheckpoint = {
  km: number;
  name: string;
  type: "ravito" | "checkpoint";
};

export type OnboardingState = {
  distance: number | null;
  elevation: number | null;
  goal: Goal | null;
  eatingEase: EatingEase | null;
  sweatLevel: SweatLevel | null;
  raceId: string | null;
  checkpoints: RaceCheckpoint[] | null;
};

type OnboardingContextType = {
  state: OnboardingState;
  setDistance: (v: number) => void;
  setElevation: (v: number) => void;
  setGoal: (v: Goal) => void;
  setEatingEase: (v: EatingEase) => void;
  setSweatLevel: (v: SweatLevel) => void;
  setRaceSelection: (raceId: string, distanceKm: number, elevationM: number, checkpoints: RaceCheckpoint[]) => void;
  clearRaceSelection: () => void;
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState>({
    distance: null,
    elevation: null,
    goal: null,
    eatingEase: null,
    sweatLevel: null,
    raceId: null,
    checkpoints: null,
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
          })),
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
