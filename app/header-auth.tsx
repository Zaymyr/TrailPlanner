"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import { clearStoredSession, readStoredSession } from "../lib/auth-storage";

type HeaderSession = { email?: string } | null;

export function HeaderAuth() {
  const [session, setSession] = useState<HeaderSession>(null);

  useEffect(() => {
    const storedSession = readStoredSession();

    if (!storedSession?.accessToken) {
      return;
    }

    const verify = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          headers: {
            Authorization: `Bearer ${storedSession.accessToken}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          clearStoredSession();
          setSession(null);
          return;
        }

        const data = (await response.json().catch(() => null)) as
          | {
              user?: {
                email?: string;
              };
            }
          | null;

        setSession({ email: data?.user?.email ?? storedSession.email });
      } catch (error) {
        console.error("Unable to verify session for header", error);
        clearStoredSession();
        setSession(null);
      }
    };

    void verify();
  }, []);

  const handleSignOut = () => {
    clearStoredSession();
    setSession(null);
  };

  if (session) {
    return (
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-sm font-medium text-emerald-100">
          {session.email ?? "Signed in"}
        </span>
        <Button
          variant="outline"
          className="border-emerald-300/60 text-emerald-50 hover:border-emerald-200"
          onClick={handleSignOut}
        >
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/sign-in"
        className="rounded-lg border border-emerald-300/40 px-3 py-1.5 text-sm font-medium text-emerald-100 transition hover:border-emerald-200 hover:text-emerald-50"
      >
        Sign in
      </Link>
      <Link
        href="/sign-up"
        className="rounded-lg bg-emerald-400 px-3 py-1.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-300"
      >
        Sign up
      </Link>
    </div>
  );
}
