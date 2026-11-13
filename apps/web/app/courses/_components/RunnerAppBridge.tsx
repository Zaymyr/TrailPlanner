"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { APP_INSTALL_HELP_URL, resolveAppStoreTarget, type AppStoreTarget } from "../../../lib/app-store";

export function RunnerAppBridge({ courseName, universalUrl, racebookAvailable }: {
  courseName: string;
  universalUrl: string;
  racebookAvailable: boolean;
}) {
  const [mobileTarget, setMobileTarget] = useState<AppStoreTarget>({ url: APP_INSTALL_HELP_URL, platform: "fallback" });
  useEffect(() => setMobileTarget(resolveAppStoreTarget(window.navigator.userAgent)), []);
  const qrUrl = `https://quickchart.io/qr?size=220&margin=1&text=${encodeURIComponent(universalUrl)}`;

  return (
    <aside className="rounded-xl border border-brand-border bg-brand-surface p-5" aria-labelledby="runner-app-heading">
      <div className="grid items-center gap-5 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <h3 id="runner-app-heading" className="text-lg font-semibold text-foreground">
            {racebookAvailable ? `Le Livret coureur de ${courseName} est dans l’app` : "Retrouve les informations de course dans l’app"}
          </h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Barrières horaires et détail de chaque ravito sont disponibles dans le Livret coureur lorsqu’ils sont publiés par l’organisation.
          </p>
          <a href={mobileTarget.url} target={mobileTarget.url.startsWith("https://") ? "_blank" : undefined} rel={mobileTarget.url.startsWith("https://") ? "noreferrer" : undefined} className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light md:hidden">
            Ouvrir l’app
          </a>
        </div>
        <div className="hidden text-center md:block">
          <a href={universalUrl} className="inline-block rounded-lg bg-white p-2 shadow-sm">
            <Image src={qrUrl} width={132} height={132} sizes="132px" unoptimized alt={`QR code pour ouvrir ${courseName} dans l’app Pace Yourself`} />
          </a>
          <p className="mt-1 text-xs text-muted-foreground">Scanner avec un téléphone</p>
        </div>
      </div>
    </aside>
  );
}
