"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { useVerifiedSession } from "../hooks/useVerifiedSession";

const FEATURES = [
  {
    icon: "∞",
    title: "Unlimited race plans",
    description: "Create and manage as many race plans as you need - no cap, no restrictions.",
  },
  {
    icon: "⚡",
    title: "Auto-fill nutrition",
    description: "Let the planner automatically fill your nutrition targets based on your profile and race data.",
  },
  {
    icon: "📤",
    title: "Export to PDF & CSV",
    description: "Download your race plan as a PDF or CSV to share with your coach or print for race day.",
  },
  {
    icon: "⭐",
    title: "Unlimited favorites",
    description: "Save unlimited products to your favorites for quick access during plan creation.",
  },
  {
    icon: "🔄",
    title: "Priority updates",
    description: "Get access to new features as soon as they ship, before anyone else.",
  },
];

const FREE_LIMITS = [
  "1 race plan",
  "Custom products included",
  "No PDF / CSV export",
  "No auto-fill",
];

const PREMIUM_LIMITS = [
  "Unlimited race plans",
  "Priority updates",
  "PDF & CSV export",
  "Auto-fill nutrition",
];

export default function PremiumPage() {
  const { session } = useVerifiedSession();
  const [upgradeStatus, setUpgradeStatus] = useState<"idle" | "opening">("idle");
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const handleUpgrade = useCallback(async () => {
    if (!session?.accessToken) {
      setUpgradeError("You need to be signed in to subscribe.");
      return;
    }

    setUpgradeStatus("opening");
    setUpgradeError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      const data = (await response.json().catch(() => null)) as { url?: string; message?: string } | null;

      if (!response.ok || !data?.url) {
        throw new Error(data?.message ?? "Unable to open checkout. Please try again.");
      }

      const popup = window.open(data.url, "_blank", "noopener,noreferrer");
      if (!popup) {
        throw new Error("Your browser blocked the checkout window. Please allow pop-ups and try again.");
      }

      popup.opener = null;
      popup.focus();
    } catch (error) {
      setUpgradeError(error instanceof Error ? error.message : "Unable to open checkout. Please try again.");
    } finally {
      setUpgradeStatus("idle");
    }
  }, [session?.accessToken]);

  return (
    <div className="mx-auto max-w-3xl space-y-12 py-4">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-1.5 text-sm font-medium text-amber-600 dark:text-amber-300">
          <span>✦</span>
          <span>Premium</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Take your race prep to the next level
        </h1>
        <p className="mx-auto max-w-xl text-base text-muted-foreground">
          Premium unlocks everything in Pace Yourself - unlimited plans, smart auto-fill, and full export support.
          One subscription, no surprises.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-amber-400/10 dark:bg-card/60"
          >
            <div className="mb-3 text-2xl">{feature.icon}</div>
            <h3 className="mb-1 text-sm font-semibold text-foreground">{feature.title}</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Free</p>
          <ul className="space-y-2">
            {FREE_LIMITS.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-muted-foreground/40">✕</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-amber-300/40 bg-amber-50/40 p-6 shadow-sm dark:border-amber-400/20 dark:bg-amber-500/5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Premium
          </p>
          <ul className="space-y-2">
            {PREMIUM_LIMITS.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                <span className="text-amber-500">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 text-center">
        {session ? (
          <>
            <button
              type="button"
              onClick={handleUpgrade}
              disabled={upgradeStatus === "opening"}
              className="premium-glow inline-flex items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-400/90 px-8 py-3 text-sm font-semibold text-slate-950 shadow-md transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-300/40 dark:bg-amber-400/80 dark:hover:bg-amber-400/90"
            >
              {upgradeStatus === "opening" ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                  Opening checkout...
                </>
              ) : (
                <>✦ Get Premium</>
              )}
            </button>
            {upgradeError ? (
              <p className="text-xs text-red-600 dark:text-red-400">{upgradeError}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Cancel anytime from your{" "}
              <Link href="/profile" className="underline underline-offset-2 hover:text-foreground">
                profile
              </Link>
              .
            </p>
          </>
        ) : (
          <>
            <Link
              href="/sign-in"
              className="premium-glow inline-flex items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-400/90 px-8 py-3 text-sm font-semibold text-slate-950 shadow-md transition hover:bg-amber-400 dark:border-amber-300/40 dark:bg-amber-400/80 dark:hover:bg-amber-400/90"
            >
              ✦ Sign in to subscribe
            </Link>
            <p className="text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link href="/sign-in" className="underline underline-offset-2 hover:text-foreground">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
