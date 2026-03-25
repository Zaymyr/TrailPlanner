"use client";

import React, { createContext, useContext, useState } from "react";

export type Goal = "comfort" | "good_time" | "performance";
export type EatingEase = "hard" | "ok" | "easy";
export type SweatLevel = "a_lot" | "normal" | "little";

export type OnboardingState = {
  distance: number | null;
  elevation: number | null;
  goal: Goal | null;
  eatingEase: EatingEase | null;
  sweatLevel: SweatLevel | null;
};

type OnboardingContextType = {
  state: OnboardingState;
  setDistance: (v: number) => void;
  setElevation: (v: number) => void;
  setGoal: (v: Goal) => void;
  setEatingEase: (v: EatingEase) => void;
  setSweatLevel: (v: SweatLevel) => void;
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState>({
    distance: null,
    elevation: null,
    goal: null,
    eatingEase: null,
    sweatLevel: null,
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
