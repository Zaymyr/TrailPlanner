"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useOnboarding } from "../../contexts/OnboardingContext";

export function RunnerOnboardingGate({ children }: { children: ReactNode }) {
  const [legacy, setLegacy] = useState(false);
  const router = useRouter();
  const { state } = useOnboarding();
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/runner/config", { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      if (!data.enabled) { setLegacy(true); return; }
      const race = state.raceId;
      router.replace((race ? `/race-planner?catalogRaceId=${encodeURIComponent(race)}` : "/race-planner") as Route);
    }).catch(() => {});
    return () => controller.abort();
  }, [router, state.raceId]);
  return legacy ? children : <p role="status" className="p-6">Chargement…</p>;
}
