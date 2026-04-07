"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { trackOnboardingEvent } from "../../lib/google-analytics";
import { canLoadAnalytics, COOKIE_CONSENT_EVENT } from "../../lib/cookies/consent";

const SESSION_STORAGE_KEY = "trailplanner.onboarding.analyticsSessionId";

type OnboardingStep = {
  path: string;
  name: string;
  index: number;
};

type StepVisit = {
  enteredAt: number;
  location: string;
  sessionId: string;
  step: OnboardingStep;
};

const ONBOARDING_STEPS: OnboardingStep[] = [
  { path: "/onboarding", name: "landing", index: 0 },
  { path: "/onboarding/race", name: "race", index: 1 },
  { path: "/onboarding/goal", name: "goal", index: 2 },
  { path: "/onboarding/loading", name: "loading", index: 3 },
  { path: "/onboarding/result", name: "result", index: 4 },
  { path: "/onboarding/nutrition/food", name: "nutrition_food", index: 5 },
  { path: "/onboarding/nutrition", name: "nutrition", index: 5 },
  { path: "/onboarding/improve", name: "improve", index: 6 },
  { path: "/onboarding/install", name: "install", index: 7 },
  { path: "/onboarding/account", name: "account", index: 8 },
];

function getSessionId() {
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const id =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    window.sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    return "unavailable";
  }
}

function getSessionIdIfAnalyticsEnabled() {
  return canLoadAnalytics() ? getSessionId() : "consent_not_granted";
}

function getStep(pathname: string | null): OnboardingStep | null {
  if (!pathname) {
    return null;
  }

  const normalized = pathname.replace(/\/$/, "") || "/";
  return ONBOARDING_STEPS.find((step) => step.path === normalized) ?? null;
}

function getVisitParams(visit: StepVisit, now = Date.now()) {
  return {
    duration_ms: Math.max(0, now - visit.enteredAt),
    page_location: visit.location,
    onboarding_session_id: visit.sessionId,
    step_index: visit.step.index,
    step_name: visit.step.name,
    step_path: visit.step.path,
  };
}

export function OnboardingAnalyticsTracker() {
  const pathname = usePathname();
  const activeVisitRef = useRef<StepVisit | null>(null);
  const lastExitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const step = getStep(pathname);
    if (!step) {
      return;
    }

    const now = Date.now();
    const previousVisit = activeVisitRef.current;

    if (previousVisit && previousVisit.step.path !== step.path) {
      trackOnboardingEvent("step_exit", {
        ...getVisitParams(previousVisit, now),
        exit_type: "route_change",
        to_step_index: step.index,
        to_step_name: step.name,
        to_step_path: step.path,
      });
    }

    const visit: StepVisit = {
      enteredAt: now,
      location: window.location.href,
      sessionId: getSessionIdIfAnalyticsEnabled(),
      step,
    };

    activeVisitRef.current = visit;
    lastExitKeyRef.current = null;

    trackOnboardingEvent("step_view", {
      page_location: visit.location,
      onboarding_session_id: visit.sessionId,
      step_index: step.index,
      step_name: step.name,
      step_path: step.path,
    });
  }, [pathname]);

  useEffect(() => {
    const handleConsentChange = () => {
      const visit = activeVisitRef.current;
      if (!visit || !canLoadAnalytics()) {
        return;
      }

      const refreshedVisit: StepVisit = {
        ...visit,
        enteredAt: Date.now(),
        location: window.location.href,
        sessionId: getSessionId(),
      };

      activeVisitRef.current = refreshedVisit;
      lastExitKeyRef.current = null;

      trackOnboardingEvent("step_view", {
        consent_updated: true,
        page_location: refreshedVisit.location,
        onboarding_session_id: refreshedVisit.sessionId,
        step_index: refreshedVisit.step.index,
        step_name: refreshedVisit.step.name,
        step_path: refreshedVisit.step.path,
      });
    };

    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);

    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
    };
  }, []);

  useEffect(() => {
    const reportExit = (exitType: "pagehide" | "visibility_hidden") => {
      const visit = activeVisitRef.current;
      if (!visit) {
        return;
      }

      const eventName = exitType === "visibility_hidden" ? "step_hidden" : "step_exit";
      const exitKey = `${visit.step.path}:${visit.enteredAt}:${exitType}`;
      if (lastExitKeyRef.current === exitKey) {
        return;
      }

      lastExitKeyRef.current = exitKey;
      trackOnboardingEvent(eventName, {
        ...getVisitParams(visit),
        exit_type: exitType,
        transport_type: "beacon",
      });
    };

    const handlePageHide = () => reportExit("pagehide");
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        reportExit("visibility_hidden");
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
