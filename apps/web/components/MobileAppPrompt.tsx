"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { useI18n } from "../app/i18n-provider";
import { COOKIE_CONSENT_EVENT, getCookieConsent } from "../lib/cookies/consent";
import { trackGoogleAnalyticsEvent } from "../lib/google-analytics";
import { isSpotlightOverlayOpen, SPOTLIGHT_OVERLAY_EVENT } from "../lib/spotlight-overlay";
import { resolveAppStoreTarget, type AppStoreTarget } from "../lib/app-store";
import { isMobileAppPromptHiddenPath } from "./mobile-app-prompt-paths";

const DISMISS_KEY = "trailplanner.mobileAppPrompt.dismissedUntil";
const DISMISS_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

const getDismissedUntil = () => {
  try {
    return Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
  } catch {
    return 0;
  }
};

const setDismissedUntil = () => {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DURATION_MS));
  } catch {
    // Ignore storage errors and only hide for the current page view.
  }
};

const isMobileBrowser = () => {
  const userAgent = window.navigator.userAgent;
  const mobileUserAgent = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(userAgent);
  const narrowViewport = window.matchMedia("(max-width: 767px)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  return mobileUserAgent || (narrowViewport && coarsePointer);
};

const isStandaloneApp = () => {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };

  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
};

export function MobileAppPrompt() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const [storeTarget, setStoreTarget] = useState<AppStoreTarget | null>(null);
  const hasTrackedViewRef = useRef(false);
  // The cookie banner owns the screen until answered: if it was pending when this page view
  // started, stay hidden for the rest of the view instead of popping up right after the answer.
  const consentPendingAtLoadRef = useRef<boolean | null>(null);

  const shouldHideForPath = useMemo(() => isMobileAppPromptHiddenPath(pathname), [pathname]);

  useEffect(() => {
    if (shouldHideForPath || typeof window === "undefined") {
      setIsVisible(false);
      return;
    }

    hasTrackedViewRef.current = false;
    if (consentPendingAtLoadRef.current === null) {
      consentPendingAtLoadRef.current = !getCookieConsent();
    }

    const updateVisibility = () => {
      if (consentPendingAtLoadRef.current || isSpotlightOverlayOpen() || !getCookieConsent() || !isMobileBrowser() || isStandaloneApp()) {
        setIsVisible(false);
        return;
      }

      const dismissedUntil = getDismissedUntil();
      if (!Number.isNaN(dismissedUntil) && dismissedUntil > Date.now()) {
        setIsVisible(false);
        return;
      }

      const target = resolveAppStoreTarget(window.navigator.userAgent);
      setStoreTarget(target);
      setIsVisible(true);
      if (!hasTrackedViewRef.current) {
        hasTrackedViewRef.current = true;
        trackGoogleAnalyticsEvent("mobile_app_prompt_view", {
          event_category: "app_download",
          platform: target.platform,
          path: pathname,
        });
      }
    };

    updateVisibility();

    window.addEventListener("resize", updateVisibility);
    window.addEventListener(COOKIE_CONSENT_EVENT, updateVisibility);
    window.addEventListener(SPOTLIGHT_OVERLAY_EVENT, updateVisibility);

    return () => {
      window.removeEventListener("resize", updateVisibility);
      window.removeEventListener(COOKIE_CONSENT_EVENT, updateVisibility);
      window.removeEventListener(SPOTLIGHT_OVERLAY_EVENT, updateVisibility);
    };
  }, [pathname, shouldHideForPath]);

  const handleDismiss = () => {
    setDismissedUntil();
    setIsVisible(false);
    trackGoogleAnalyticsEvent("mobile_app_prompt_dismiss", {
      event_category: "app_download",
      path: pathname,
    });
  };

  const handleDownload = () => {
    setDismissedUntil();
    trackGoogleAnalyticsEvent("mobile_app_prompt_download", {
      event_category: "app_download",
      platform: storeTarget?.platform,
      path: pathname,
    });
  };

  if (!isVisible || !storeTarget) {
    return null;
  }

  const isExternalLink = storeTarget.url.startsWith("https://");

  return (
    // Thin bottom bar (not a card): it must never cover a form. Hidden from md up, on store-button pages and
    // while another overlay is open (see above).
    <aside
      aria-label={t.mobileAppPrompt.title}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-border bg-card/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-md items-center gap-2">
        <p className="min-w-0 flex-1 text-[13px] font-semibold leading-tight text-foreground">{t.mobileAppPrompt.title}</p>
        <a
          href={storeTarget.url}
          target={isExternalLink ? "_blank" : undefined}
          rel={isExternalLink ? "noreferrer" : undefined}
          onClick={handleDownload}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t.mobileAppPrompt.cta}
        </a>
        <button
          type="button"
          aria-label={t.mobileAppPrompt.dismissLabel}
          onClick={handleDismiss}
          className="-mr-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
