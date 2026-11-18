"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { ANDROID_APP_STORE_URL, PUBLIC_IOS_APP_STORE_URL, detectMobileAppPlatform } from "../../../../lib/app-store";
import { trackCrewAppGate } from "../../../../lib/product-analytics";

export type PlanSharePlatform = "android" | "ios" | "other";
type Platform = PlanSharePlatform;

const COPY = {
  fr: {
    title: "Suis {name} en direct dans l'app",
    body: "L'app Pace Yourself est faite pour le jour J : valide chaque passage, coche ce que tu as donné et lance l'itinéraire vers le prochain ravito.",
    benefits: [
      "Heures de passage recalculées en direct",
      "Checklist de ce qu'il faut donner à chaque ravito",
      "Itinéraires vers les points d'assistance",
    ],
    download: "Télécharger l'app",
    openApp: "J'ai déjà l'app : ouvrir le plan",
    continueWeb: "Continuer sur le web",
  },
  en: {
    title: "Follow {name} live in the app",
    body: "The Pace Yourself app is built for race day: confirm each passage, tick what you handed over and get directions to the next aid station.",
    benefits: [
      "Passage times recalculated live",
      "Checklist of what to hand over at each aid station",
      "Directions to crew points",
    ],
    download: "Download the app",
    openApp: "I already have the app: open the plan",
    continueWeb: "Continue on the web",
  },
} as const;

const continueKey = (planId: string) => `paceyourself.plan-share-continue-web:${planId}`;

/**
 * Full-screen app-first gate for phones that reached the public crew page,
 * i.e. the installed app did not claim the universal link. The web page stays
 * one small tap away and that choice is remembered on the device.
 */
export function PlanShareAppGate({
  token,
  planId,
  planName,
  locale,
  initialPlatform,
}: {
  token: string;
  planId: string;
  planName: string;
  locale: "fr" | "en";
  initialPlatform: Platform | null;
}) {
  const copy = COPY[locale];
  const [platform, setPlatform] = useState<Platform | null>(initialPlatform);
  const [visible, setVisible] = useState(initialPlatform !== null);
  const trackedView = useRef(false);

  useEffect(() => {
    const touchMac = /Macintosh/i.test(window.navigator.userAgent) && window.navigator.maxTouchPoints > 1;
    const detected = detectMobileAppPlatform(window.navigator.userAgent) ?? (touchMac ? "ios" : null);
    let continued = false;
    try {
      continued = window.localStorage.getItem(continueKey(planId)) === "1";
    } catch {
      continued = false;
    }
    setPlatform(detected);
    setVisible(detected !== null && !continued);
  }, [planId]);

  useEffect(() => {
    if (!visible || !platform || trackedView.current) return;
    trackedView.current = true;
    trackCrewAppGate({ action: "viewed", platform });
  }, [platform, visible]);

  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [visible]);

  if (!visible || !platform) return null;

  const storeUrl = platform === "ios" ? PUBLIC_IOS_APP_STORE_URL : platform === "android" ? ANDROID_APP_STORE_URL : "/links";

  const continueOnWeb = () => {
    try {
      window.localStorage.setItem(continueKey(planId), "1");
    } catch {
      // Without storage the gate simply shows again on the next visit.
    }
    trackCrewAppGate({ action: "continue_web", platform });
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-share-app-gate-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-background"
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-4 py-6">
        <Image
          src="/branding/logo-horizontal-v2.png"
          alt="Pace Yourself"
          width={213}
          height={50}
          priority
          unoptimized
          className="h-10 w-auto self-start"
        />
        <div className="flex flex-1 flex-col justify-center gap-5">
          <h1 id="plan-share-app-gate-title" className="break-words text-3xl font-bold leading-tight text-foreground">
            {copy.title.replace("{name}", planName)}
          </h1>
          <p className="text-base leading-7 text-muted-foreground">{copy.body}</p>
          <ul className="flex flex-col gap-2 rounded-lg border border-brand-border bg-brand-surface p-4">
            {copy.benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-sm font-semibold text-foreground">
                <span aria-hidden="true" className="font-bold text-brand">✓</span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <a
            href={storeUrl}
            target={storeUrl.startsWith("https://") ? "_blank" : undefined}
            rel={storeUrl.startsWith("https://") ? "noreferrer" : undefined}
            onClick={() => trackCrewAppGate({ action: "download", platform })}
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-5 text-base font-bold text-brand-foreground"
          >
            {copy.download}
          </a>
          <a
            href={`paceyourself://share/plan/${encodeURIComponent(token)}`}
            onClick={() => trackCrewAppGate({ action: "open_app", platform })}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-border bg-card px-4 text-sm font-bold text-brand"
          >
            {copy.openApp}
          </a>
          <button
            type="button"
            onClick={continueOnWeb}
            className="mx-auto min-h-11 px-3 text-xs font-semibold text-muted-foreground underline underline-offset-2"
          >
            {copy.continueWeb}
          </button>
        </div>
      </div>
    </div>
  );
}
