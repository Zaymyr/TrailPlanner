"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

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

type VerifiedSessionContextValue = {
  session: VerifiedSession | null;
  isLoading: boolean;
  refresh: () => Promise<boolean>;
  clearSession: () => void;
};

const VerifiedSessionContext = createContext<VerifiedSessionContextValue | null>(null);

const useVerifiedSessionState = (): VerifiedSessionContextValue => {
  const [session, setSession] = useState<VerifiedSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshInFlight = useRef<Promise<boolean> | null>(null);
  const hasInitialized = useRef(false);

  const clearSession = useCallback(() => {
    void fetch("/api/auth/signout", { method: "POST" }).catch(() => null);
    clearStoredSession();
    clearRacePlannerStorage();
    setSession(null);
    setIsLoading(false);
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }

    const task = (async () => {
      if (!hasInitialized.current) {
        setIsLoading(true);
      }

      try {
        const stored = readStoredSession();

        if (!stored?.accessToken) {
          clearSession();
          return false;
        }

        const response = await fetch("/api/auth/session", {
          headers: {
            Authorization: `Bearer ${stored.accessToken}`,
            ...(stored.refreshToken ? { "x-refresh-token": `Bearer ${stored.refreshToken}` } : {}),
          },
          cache: "no-store",
        });

        if (!response.ok) {
          if (response.status === 401) {
            clearSession();
          } else {
            setIsLoading(false);
          }
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
        setIsLoading(false);
        return false;
      } finally {
        hasInitialized.current = true;
        refreshInFlight.current = null;
      }
    })();

    refreshInFlight.current = task;
    return task;
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

    const handleSessionUpdated = () => {
      void refresh();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && ![ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, SESSION_EMAIL_KEY].includes(event.key)) {
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
    window.addEventListener("trailplanner:session-updated", handleSessionUpdated);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("trailplanner:session-updated", handleSessionUpdated);
    };
  }, [clearSession, refresh]);

  return { session, isLoading, refresh, clearSession };
};

export const VerifiedSessionProvider = ({ children }: { children: ReactNode }) => {
  const value = useVerifiedSessionState();
  return <VerifiedSessionContext.Provider value={value}>{children}</VerifiedSessionContext.Provider>;
};

export const useVerifiedSession = () => {
  const context = useContext(VerifiedSessionContext);
  if (!context) {
    throw new Error("useVerifiedSession must be used within a VerifiedSessionProvider");
  }
  return context;
};
