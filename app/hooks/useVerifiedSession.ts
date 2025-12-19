"use client";

import { useCallback, useEffect, useState } from "react";

import { clearStoredSession, readStoredSession } from "../../lib/auth-storage";

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
    setSession(null);
    setIsLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const stored = readStoredSession();

    if (!stored?.accessToken) {
      clearSession();
      return;
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
        return;
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
    } catch (error) {
      console.error("Unable to verify session", error);
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { session, isLoading, refresh, clearSession };
};
