"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { APP_INSTALL_HELP_URL, resolveAppStoreTarget, type AppStoreTarget } from "../../../lib/app-store";

export function RunnerAppBridge({
  courseName,
  universalUrl,
  racebookAvailable,
  context = "course",
}: {
  courseName: string;
  universalUrl: string;
  racebookAvailable: boolean;
  context?: "course" | "estimate";
}) {
  const [mobileTarget, setMobileTarget] = useState<AppStoreTarget>({
    url: APP_INSTALL_HELP_URL,
    platform: "fallback",
  });
  useEffect(() => setMobileTarget(resolveAppStoreTarget(window.navigator.userAgent)), []);
  const qrUrl = `https://quickchart.io/qr?size=220&margin=1&text=${encodeURIComponent(universalUrl)}`;
  const title = context === "estimate"
    ? "Retrouve ce plan et le Livret coureur dans l’app"
    : racebookAvailable
      ? `Le Livret coureur de ${courseName} est dans l’app`
      : "Prépare et suis ta course dans l’app";

  return (
    <section className="rounded-2xl border border-brand-border bg-brand-surface p-6 sm:p-8" aria-labelledby="runner-app-heading">
      <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <h2 id="runner-app-heading" className="text-2xl font-semibold text-foreground">{title}</h2>
          <p className="max-w-2xl leading-7 text-muted-foreground">
            {racebookAvailable
              ? "Retrouve les informations officielles publiées par l’organisation et garde-les à portée de main le jour J."
              : "Retrouve tes courses, tes estimations et les informations publiées par les organisateurs au même endroit."}
          </p>
          <a
            href={mobileTarget.url}
            target={mobileTarget.url.startsWith("https://") ? "_blank" : undefined}
            rel={mobileTarget.url.startsWith("https://") ? "noreferrer" : undefined}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light md:hidden"
          >
            Ouvrir l’app
          </a>
        </div>
        <div className="hidden text-center md:block">
          <a href={universalUrl} className="inline-block rounded-xl bg-white p-3 shadow-sm">
            <Image
              src={qrUrl}
              width={180}
              height={180}
              sizes="180px"
              unoptimized
              alt={`QR code pour ouvrir ${courseName} dans l’app Pace Yourself`}
            />
          </a>
          <p className="mt-2 text-sm text-muted-foreground">Scanne ce QR code avec ton téléphone</p>
          <a href={universalUrl} className="mt-1 inline-flex min-h-11 items-center font-semibold text-brand hover:underline">
            Ouvrir le lien vers la course
          </a>
        </div>
      </div>
    </section>
  );
}
