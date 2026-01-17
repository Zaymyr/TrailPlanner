"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { useI18n } from "../app/i18n-provider";

const DISMISS_KEY = "planner_guest_banner_dismissed_until";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

type GuestSaveBannerProps = {
  isAuthed: boolean;
};

const formatDismissUntil = () => String(Date.now() + DISMISS_DURATION_MS);

export function GuestSaveBanner({ isAuthed }: GuestSaveBannerProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isAuthed) {
      setIsVisible(false);
      return;
    }

    const stored = window.localStorage.getItem(DISMISS_KEY);
    const dismissedUntil = stored ? Number(stored) : 0;

    if (!dismissedUntil || Number.isNaN(dismissedUntil) || dismissedUntil < Date.now()) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isAuthed]);

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, formatDismissUntil());
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const { guestBanner } = t.racePlanner.account;

  return (
    <div className="relative rounded-lg border border-emerald-200/60 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-200/70 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100">
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 8h.01" />
              <path d="M12 12v6" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </span>
          <div className="space-y-1">
            <p className="font-semibold">{guestBanner.title}</p>
            <p className="text-emerald-900/80 dark:text-emerald-100/80">{guestBanner.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button type="button" className="h-9" onClick={() => router.push("/sign-up")}>
            {guestBanner.cta}
          </Button>
        </div>
      </div>
      <button
        type="button"
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-emerald-900/70 transition hover:bg-emerald-200/70 hover:text-emerald-950 dark:text-emerald-100/70 dark:hover:bg-emerald-500/20"
        aria-label={guestBanner.dismissLabel}
        onClick={handleDismiss}
      >
        ×
      </button>
    </div>
  );
}
