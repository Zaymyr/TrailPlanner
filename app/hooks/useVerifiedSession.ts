"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  SESSION_EMAIL_KEY,
  clearStoredSession,
  readStoredSession,
} from "../../lib/auth-storage";
import { clearRacePlannerStorage } from "../../lib/race-planner-storage";

export type VerifiedSession = {
  id?: string;
  accessToken: string;
  refreshToken?: string;
  email?: string;
  role?: string;
  roles?: string[];
};

type SessionResponse = {
  user?: {
    id: string;
    email?: string;
    role?: string;
    roles?: string[];
  };
};

export const useVerifiedSession = () => {
  const [session, setSession] = useState<VerifiedSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    void fetch("/api/auth/signout", { method: "POST" }).catch(() => null);
    clearStoredSession();
    clearRacePlannerStorage();
    setSession(null);
    setIsLoading(false);
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    const stored = readStoredSession();

    if (!stored?.accessToken) {
      clearSession();
      return false;
    }

    try {
      const response = await fetch("/api/auth/session", {
        headers: {
          Authorization: `Bearer ${stored.accessToken}`,
          ...(stored.refreshToken ? { "x-refresh-token": `Bearer ${stored.refreshToken}` } : {}),
        },
        cache: "no-store",
      });

      if (!response.ok) {
        clearSession();
        return false;
      }

      const data = (await response.json().catch(() => null)) as SessionResponse | null;
      const user = data?.user;

      setSession({
        id: user?.id,
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
        email: user?.email ?? stored.email,
        role: user?.role,
        roles: user?.roles,
      });
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Unable to verify session", error);
      clearSession();
      return false;
    }
  }, [clearSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    const handleFocus = () => {
      void refresh();
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key &&
        ![ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, SESSION_EMAIL_KEY].includes(event.key)
      ) {
        return;
      }

      const stored = readStoredSession();
      if (!stored?.accessToken) {
        clearSession();
        return;
      }

      void refresh();
    };

    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorage);
    };
  }, [clearSession, refresh]);

  return { session, isLoading, refresh, clearSession };
};
