"use client";

import { useMemo } from "react";

import type { CoachIntakeTargets } from "../../lib/coach-intake-targets";

export type IntakeTargets = {
  carbsPerHour: number;
  waterMlPerHour: number;
  sodiumMgPerHour: number;
};

const resolveNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const hasCoachOverrides = (coachTargets?: CoachIntakeTargets | null): boolean =>
  Boolean(
    coachTargets &&
      [coachTargets.carbsPerHour, coachTargets.waterMlPerHour, coachTargets.sodiumMgPerHour].some(
        (value) => typeof value === "number" && Number.isFinite(value)
      )
  );

export const resolveEffectiveIntakeTargets = (
  baseTargets: IntakeTargets,
  coachTargets?: CoachIntakeTargets | null
): IntakeTargets => ({
  carbsPerHour: resolveNumber(coachTargets?.carbsPerHour) ?? baseTargets.carbsPerHour,
  waterMlPerHour: resolveNumber(coachTargets?.waterMlPerHour) ?? baseTargets.waterMlPerHour,
  sodiumMgPerHour: resolveNumber(coachTargets?.sodiumMgPerHour) ?? baseTargets.sodiumMgPerHour,
});

export const useEffectiveIntakeTargets = (
  baseTargets: IntakeTargets,
  coachTargets?: CoachIntakeTargets | null
): { effectiveTargets: IntakeTargets; isCoachManaged: boolean } =>
  useMemo(() => {
    const effectiveTargets = resolveEffectiveIntakeTargets(baseTargets, coachTargets);
    const isCoachManaged = hasCoachOverrides(coachTargets);

    return { effectiveTargets, isCoachManaged };
  }, [baseTargets, coachTargets]);
