"use client";

import type { ReactNode } from "react";
import { Button } from "../ui/button";

type RacePlannerLayoutProps = {
  heroTitle?: string;
  heroDescription?: string;
  heroActions?: ReactNode;
  heroBackground?: ReactNode;
  planContent: ReactNode;
  planSecondaryContent?: ReactNode;
  settingsContent: ReactNode;
  mobileView: "plan" | "settings";
  onMobileViewChange: (view: "plan" | "settings") => void;
  planLabel: string;
  settingsLabel: string;
  className?: string;
};

export function RacePlannerLayout({
  planContent,
  planSecondaryContent,
  settingsContent,
  mobileView,
  onMobileViewChange,
  planLabel,
  settingsLabel,
  className,
  heroTitle,
  heroDescription,
  heroActions,
  heroBackground,
}: RacePlannerLayoutProps) {
  return (
    <div className={className}>
      {heroTitle ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/80 px-4 py-5 shadow-lg">
          {heroBackground ? (
            <div className="pointer-events-none absolute inset-0 opacity-70">
              {heroBackground}
            </div>
          ) : null}
          <div className="relative grid gap-4 lg:grid-cols-[1.4fr,1fr] lg:items-center">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
                TrailPlanner
              </p>
              <h1 className="text-2xl font-bold text-slate-50 sm:text-3xl">{heroTitle}</h1>
              {heroDescription ? <p className="text-sm text-slate-300">{heroDescription}</p> : null}
            </div>
            {heroActions ? (
              <div className="flex flex-col gap-3 rounded-xl border border-slate-800/60 bg-slate-950/80 p-4 shadow-inner">
                {heroActions}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-4 xl:hidden">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { key: "plan", label: planLabel },
                { key: "settings", label: settingsLabel },
              ] satisfies { key: "plan" | "settings"; label: string }[]
            ).map((tab) => {
              const isActive = mobileView === tab.key;
              return (
                <Button
                  key={tab.key}
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  className="w-full justify-center"
                  aria-pressed={isActive}
                  onClick={() => onMobileViewChange(tab.key)}
                >
                  {tab.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className={mobileView === "plan" ? "space-y-6" : "hidden"}>
            <div className="space-y-6">{planContent}</div>
            {planSecondaryContent ? <div className="space-y-6">{planSecondaryContent}</div> : null}
          </div>
          <div className={mobileView === "settings" ? "space-y-6" : "hidden"}>{settingsContent}</div>
        </div>
      </div>

      <div className="hidden xl:grid xl:grid-cols-12 xl:gap-6">
        <div className="space-y-6 xl:col-span-8 2xl:col-span-9">
          {planSecondaryContent ? (
            <div className="space-y-6 2xl:grid 2xl:grid-cols-[1.6fr,1fr] 2xl:items-start 2xl:gap-6 2xl:space-y-0">
              <div className="space-y-6">{planContent}</div>
              <div className="space-y-6">{planSecondaryContent}</div>
            </div>
          ) : (
            <div className="space-y-6">{planContent}</div>
          )}
        </div>
        <div className="space-y-6 xl:col-span-4 2xl:col-span-3 xl:sticky xl:top-4 xl:self-start">
          {settingsContent}
        </div>
      </div>
    </div>
  );
}
