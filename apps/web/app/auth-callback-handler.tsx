"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { persistSessionToStorage } from "../lib/auth-storage";
import { clearRememberedRunnerReturnPath, readRememberedRunnerReturnPath } from "../lib/organizer-acquisition";

export function AuthCallbackHandler() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash?.includes("access_token")) return;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const type = params.get("type");

    if (!accessToken) return;
    if (type === "invite" || type === "recovery" || window.location.pathname === "/reset-password") return;

    const refreshToken = params.get("refresh_token") ?? undefined;
    const email = params.get("email") ?? undefined;

    persistSessionToStorage({ accessToken, refreshToken, email });

    const cleanedUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({}, document.title, cleanedUrl);

    // Supabase falls back to the site root (tokens in the hash) when the redirect
    // URL is not accepted; resume the destination remembered before auth.
    const returnPath = readRememberedRunnerReturnPath() ?? "/race-planner";
    clearRememberedRunnerReturnPath();
    router.replace(returnPath as Route);
    router.refresh();
  }, [router]);

  return null;
}
