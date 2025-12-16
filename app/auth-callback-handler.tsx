"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { persistSessionToStorage } from "../lib/auth-storage";

export function AuthCallbackHandler() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash?.includes("access_token")) return;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");

    if (!accessToken) return;

    const refreshToken = params.get("refresh_token") ?? undefined;
    const email = params.get("email") ?? undefined;

    persistSessionToStorage({ accessToken, refreshToken, email });

    const cleanedUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({}, document.title, cleanedUrl);

    router.replace("/race-planner");
    router.refresh();
  }, [router]);

  return null;
}
