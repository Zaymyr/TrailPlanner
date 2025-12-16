"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "../../../components/ui/button";
import { persistSessionToStorage } from "../../../lib/auth-storage";

type SessionResponse = {
  user?: {
    email?: string;
  };
};

type Status = {
  message: string;
  isError?: boolean;
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({
    message: "Signing you in with Google...",
  });

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
      setStatus({
        message: errorDescription ?? "Unable to sign in with Google.",
        isError: true,
      });
      return;
    }

    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token") ?? undefined;

    if (!accessToken) {
      setStatus({
        message: "Missing access token from Google sign-in.",
        isError: true,
      });
      return;
    }

    const persistSession = async () => {
      persistSessionToStorage({ accessToken, refreshToken });

      try {
        const response = await fetch("/api/auth/session", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        });

        if (response.ok) {
          const data = (await response.json().catch(() => null)) as SessionResponse | null;
          const email = data?.user?.email;

          if (email) {
            persistSessionToStorage({ accessToken, refreshToken, email });
          }
        }
      } catch (error) {
        console.error("Unable to fetch user session after OAuth", error);
      }

      router.replace("/race-planner");
    };

    void persistSession();
  }, [router, searchParams]);

  const handleBackToSignIn = () => {
    router.push("/sign-in");
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-lg border border-slate-800 bg-slate-950/60 p-6 shadow-lg">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-50">Google sign-in</h1>
        <p className="text-slate-300">{status.message}</p>
      </div>

      {status.isError ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-amber-400">
            Please try again or use your email and password instead.
          </p>
          <Button onClick={handleBackToSignIn} variant="outline" className="w-fit">
            Back to sign in
          </Button>
        </div>
      ) : null}
    </div>
  );
}
