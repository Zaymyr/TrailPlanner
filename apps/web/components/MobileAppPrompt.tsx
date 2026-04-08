"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { useI18n } from "../app/i18n-provider";
import { COOKIE_CONSENT_EVENT, getCookieConsent } from "../lib/cookies/consent";
import { trackGoogleAnalyticsEvent } from "../lib/google-analytics";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.paceyourself.app";
const IOS_APP_STORE_URL = process.env.NEXT_PUBLIC_IOS_APP_STORE_URL?.trim() ?? "";
const INSTALL_HELP_URL = "/onboarding/install";
const DISMISS_KEY = "trailplanner.mobileAppPrompt.dismissedUntil";
const DISMISS_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
const HIDDEN_PATH_PREFIXES = ["/admin", "/onboarding"];

type StoreTarget = {
  url: string;
  platform: "android" | "ios" | "fallback";
};

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

const resolveStoreTarget = (): StoreTarget => {
  const userAgent = window.navigator.userAgent;

  if (/Android/i.test(userAgent)) {
    return { url: PLAY_STORE_URL, platform: "android" };
  }

  if (/iPhone|iPad|iPod/i.test(userAgent) && IOS_APP_STORE_URL) {
    return { url: IOS_APP_STORE_URL, platform: "ios" };
  }

  return { url: INSTALL_HELP_URL, platform: "fallback" };
};

export function MobileAppPrompt() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const [storeTarget, setStoreTarget] = useState<StoreTarget | null>(null);
  const hasTrackedViewRef = useRef(false);

  const shouldHideForPath = useMemo(
    () => HIDDEN_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)),
    [pathname],
  );

  useEffect(() => {
    if (shouldHideForPath || typeof window === "undefined") {
      setIsVisible(false);
      return;
    }

    hasTrackedViewRef.current = false;

    const updateVisibility = () => {
      if (!getCookieConsent() || !isMobileBrowser() || isStandaloneApp()) {
        setIsVisible(false);
        return;
      }

      const dismissedUntil = getDismissedUntil();
      if (!Number.isNaN(dismissedUntil) && dismissedUntil > Date.now()) {
        setIsVisible(false);
        return;
      }

      const target = resolveStoreTarget();
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

    return () => {
      window.removeEventListener("resize", updateVisibility);
      window.removeEventListener(COOKIE_CONSENT_EVENT, updateVisibility);
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
    <aside
      aria-label={t.mobileAppPrompt.title}
      className="fixed inset-x-3 bottom-3 z-40 md:hidden"
      role="dialog"
    >
      <div className="relative rounded-lg border border-emerald-200 bg-white p-4 pr-10 text-slate-950 shadow-xl shadow-slate-950/15 dark:border-emerald-500/30 dark:bg-slate-950 dark:text-slate-50">
        <button
          type="button"
          aria-label={t.mobileAppPrompt.dismissLabel}
          onClick={handleDismiss}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
        >
          x
        </button>
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{t.mobileAppPrompt.title}</p>
            <p className="text-sm leading-5 text-slate-600 dark:text-slate-300">{t.mobileAppPrompt.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={storeTarget.url}
              target={isExternalLink ? "_blank" : undefined}
              rel={isExternalLink ? "noreferrer" : undefined}
              onClick={handleDownload}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-[hsl(var(--brand))] px-3 text-sm font-semibold text-[hsl(var(--brand-foreground))] transition hover:bg-[hsl(var(--brand)/0.9)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:bg-emerald-500 dark:text-foreground dark:hover:bg-emerald-400"
            >
              {t.mobileAppPrompt.cta}
            </a>
            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex h-10 items-center justify-center rounded-md border border-border px-3 text-sm font-medium text-[hsl(var(--success))] transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:text-emerald-100 dark:hover:bg-emerald-950/60"
            >
              {t.mobileAppPrompt.later}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
