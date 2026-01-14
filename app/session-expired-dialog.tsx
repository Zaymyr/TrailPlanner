"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "./i18n-provider";
import { useVerifiedSession } from "./hooks/useVerifiedSession";
import { readStoredSession } from "../lib/auth-storage";
import { Button } from "../components/ui/button";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;

export function SessionExpiredDialog() {
  const { t } = useI18n();
  const router = useRouter();
  const { refresh } = useVerifiedSession();
  const [isOpen, setIsOpen] = useState(false);
  const lastActiveRef = useRef(Date.now());
  const isCheckingRef = useRef(false);

  const checkSession = useCallback(async () => {
    if (isCheckingRef.current || isOpen) {
      return;
    }

    const stored = readStoredSession();
    if (!stored?.accessToken) {
      return;
    }

    isCheckingRef.current = true;
    const isValid = await refresh();
    isCheckingRef.current = false;

    if (!isValid) {
      setIsOpen(true);
    }
  }, [isOpen, refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    void checkSession();

    const markActive = () => {
      lastActiveRef.current = Date.now();
    };

    const handleFocus = () => {
      markActive();
      void checkSession();
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        markActive();
        void checkSession();
      }
    };

    const passiveOptions = { passive: true } as const;

    window.addEventListener("pointerdown", markActive);
    window.addEventListener("keydown", markActive);
    window.addEventListener("mousemove", markActive);
    window.addEventListener("touchstart", markActive, passiveOptions);
    window.addEventListener("scroll", markActive, passiveOptions);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = window.setInterval(() => {
      const stored = readStoredSession();
      if (!stored?.accessToken || isOpen) {
        return;
      }

      if (Date.now() - lastActiveRef.current >= IDLE_TIMEOUT_MS) {
        void checkSession();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener("pointerdown", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("mousemove", markActive);
      window.removeEventListener("touchstart", markActive, passiveOptions);
      window.removeEventListener("scroll", markActive, passiveOptions);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [checkSession, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-10 backdrop-blur">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-emerald-300/30 bg-card p-6 text-foreground shadow-2xl dark:bg-slate-950">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">{t.auth.sessionExpired.title}</p>
          <p className="text-sm text-muted-foreground">{t.auth.sessionExpired.description}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            onClick={() => {
              setIsOpen(false);
              router.push("/sign-in");
            }}
          >
            {t.auth.sessionExpired.reconnect}
          </Button>
        </div>
      </div>
    </div>
  );
}
