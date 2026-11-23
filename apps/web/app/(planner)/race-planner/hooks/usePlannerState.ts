"use client";

import { useCallback, useEffect, useState, type SetStateAction } from "react";

export type PlannerMobileView = "plan" | "settings";
export type PlannerUpgradeReason = "autoFill" | "print" | "plans" | null;

const PLANS_PANEL_STORAGE_KEY = "pace-yourself:ui:plans-panel";

export const usePlannerState = () => {
  const [importError, setImportError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<PlannerMobileView>("plan");
  const [isSettingsCollapsed, setIsSettingsCollapsedState] = useState(false);
  const [isRaceCatalogOpen, setIsRaceCatalogOpen] = useState(false);
  const [catalogSubmissionId, setCatalogSubmissionId] = useState<string | null>(null);
  const [upgradeStatus, setUpgradeStatus] = useState<"idle" | "opening">("idle");
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<PlannerUpgradeReason>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const setIsSettingsCollapsed = useCallback((value: SetStateAction<boolean>) => {
    setIsSettingsCollapsedState((previous) => {
      const next = typeof value === "function" ? value(previous) : value;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(PLANS_PANEL_STORAGE_KEY, next ? "collapsed" : "expanded");
      }

      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(PLANS_PANEL_STORAGE_KEY);
    if (!stored) return;
    setIsSettingsCollapsedState(stored === "collapsed");
  }, []);

  return {
    state: {
      importError,
      mobileView,
      isSettingsCollapsed,
      isRaceCatalogOpen,
      catalogSubmissionId,
      upgradeStatus,
      upgradeError,
      upgradeDialogOpen,
      upgradeReason,
      onboardingOpen,
      onboardingStep,
    },
    actions: {
      setImportError,
      setMobileView,
      setIsSettingsCollapsed,
      setIsRaceCatalogOpen,
      setCatalogSubmissionId,
      setUpgradeStatus,
      setUpgradeError,
      setUpgradeDialogOpen,
      setUpgradeReason,
      setOnboardingOpen,
      setOnboardingStep,
    },
  };
};
