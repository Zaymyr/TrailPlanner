"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

import { AuthCard, AuthNotice, authSubmitClassName } from "../../../components/auth/AuthCard";
import { Button } from "../../../components/ui/button";
import { persistSessionToStorage } from "../../../lib/auth-storage";
import {
  buildAuthHref,
  clearRememberedRunnerReturnPath,
  normalizeInternalReturnPath,
  readRememberedRunnerReturnPath,
} from "../../../lib/organizer-acquisition";
import { useI18n } from "../../i18n-provider";

type SessionResponse = {
  user?: {
    email?: string;
  };
  access_token?: string;
  refresh_token?: string;
};

/** `kind` is resolved to localized copy at render time. */
type Status = {
  kind: "signingIn" | "error" | "missingToken";
  /** Provider error description, shown as-is when present. */
  detail?: string | null;
  isError?: boolean;
};

type AuthCallbackPageProps = {
  searchParams?: { next?: string | string[] };
};

export default function AuthCallbackPage({ searchParams: routeSearchParams }: AuthCallbackPageProps) {
  const router = useRouter();
  const { t } = useI18n();
  const returnPath = useMemo(
    () => routeSearchParams?.next
      ? normalizeInternalReturnPath(routeSearchParams.next)
      : readRememberedRunnerReturnPath() ?? "/race-planner",
    [routeSearchParams?.next],
  );
  const [status, setStatus] = useState<Status>({ kind: "signingIn" });

  const searchParams = useMemo(() => {
    if (typeof window === "undefined") return null;

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.substring(1)
      : window.location.hash;

    return new URLSearchParams(hash);
  }, []);

  useEffect(() => {
    if (!searchParams) return;

    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      setStatus({ kind: "error", detail: errorDescription, isError: true });
      return;
    }

    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token") ?? undefined;

    if (!accessToken) {
      setStatus({ kind: "missingToken", isError: true });
      return;
    }

    const persistSession = async () => {
      persistSessionToStorage({ accessToken, refreshToken });

      try {
        const response = await fetch("/api/auth/session", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(refreshToken ? { "x-refresh-token": `Bearer ${refreshToken}` } : {}),
          },
          cache: "no-store",
        });

        if (response.ok) {
          const data = (await response.json().catch(() => null)) as SessionResponse | null;
          const email = data?.user?.email;
          const updatedAccessToken = data?.access_token ?? accessToken;
          const updatedRefreshToken = data?.refresh_token ?? refreshToken;

          if (email || data?.access_token || data?.refresh_token) {
            persistSessionToStorage({ accessToken: updatedAccessToken, refreshToken: updatedRefreshToken, email });
          }
        }
      } catch (error) {
        console.error("Unable to fetch user session after OAuth", error);
      }

      clearRememberedRunnerReturnPath();
      router.replace(returnPath as Route);
    };

    void persistSession();
  }, [returnPath, router, searchParams]);

  const handleBackToSignIn = () => {
    router.push(buildAuthHref("/sign-in", returnPath) as Route);
  };

  const message =
    status.kind === "error"
      ? status.detail || t.auth.callback.error
      : status.kind === "missingToken"
        ? t.auth.callback.missingToken
        : t.auth.callback.signingIn;

  return (
    <AuthCard title={status.isError ? t.auth.signIn.title : t.auth.callback.title} description={status.isError ? undefined : message}>
      {status.isError ? (
        <AuthNotice>
          <p className="font-semibold">{message}</p>
          <p>{t.auth.callback.retryHint}</p>
          <Button onClick={handleBackToSignIn} className={authSubmitClassName}>
            {t.auth.callback.backToSignIn}
          </Button>
        </AuthNotice>
      ) : (
        <div aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-brand" />
        </div>
      )}
    </AuthCard>
  );
}
