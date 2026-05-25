"use client";

import { useCallback, useEffect, useState, type SetStateAction } from "react";

type FeedbackStatus = "idle" | "submitting" | "success" | "error";
export type PlannerMobileView = "plan" | "settings";
export type PlannerUpgradeReason = "autoFill" | "print" | "plans" | null;

const PLANS_PANEL_STORAGE_KEY = "pace-yourself:ui:plans-panel";

export const usePlannerState = () => {
  const [importError, setImportError] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackDetail, setFeedbackDetail] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>("idle");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [isDesktopApp, setIsDesktopApp] = useState(false);
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
      feedbackOpen,
      feedbackSubject,
      feedbackDetail,
      feedbackStatus,
      feedbackError,
      isDesktopApp,
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
      setFeedbackOpen,
      setFeedbackSubject,
      setFeedbackDetail,
      setFeedbackStatus,
      setFeedbackError,
      setIsDesktopApp,
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
