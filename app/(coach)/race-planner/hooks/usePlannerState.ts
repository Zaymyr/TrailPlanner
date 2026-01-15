"use client";

import { useState } from "react";

type FeedbackStatus = "idle" | "submitting" | "success" | "error";
export type PlannerMobileView = "plan" | "settings";
export type PlannerRightPanelTab = "fuel" | "account";
export type PlannerUpgradeReason = "autoFill" | "print" | "plans" | null;

export const usePlannerState = () => {
  const [importError, setImportError] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackDetail, setFeedbackDetail] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>("idle");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [mobileView, setMobileView] = useState<PlannerMobileView>("plan");
  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(false);
  const [isRaceCatalogOpen, setIsRaceCatalogOpen] = useState(false);
  const [catalogSubmissionId, setCatalogSubmissionId] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<PlannerRightPanelTab>("fuel");
  const [isCourseCollapsed, setIsCourseCollapsed] = useState(true);
  const [upgradeStatus, setUpgradeStatus] = useState<"idle" | "opening">("idle");
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<PlannerUpgradeReason>(null);

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
      rightPanelTab,
      isCourseCollapsed,
      upgradeStatus,
      upgradeError,
      upgradeDialogOpen,
      upgradeReason,
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
      setRightPanelTab,
      setIsCourseCollapsed,
      setUpgradeStatus,
      setUpgradeError,
      setUpgradeDialogOpen,
      setUpgradeReason,
    },
  };
};
