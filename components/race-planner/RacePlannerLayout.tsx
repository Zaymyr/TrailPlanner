"use client";

import type { ReactNode } from "react";
import { Button } from "../ui/button";

type RacePlannerLayoutProps = {
  planContent: ReactNode;
  settingsContent: ReactNode;
  mobileView: "plan" | "settings";
  onMobileViewChange: (view: "plan" | "settings") => void;
  planLabel: string;
  settingsLabel: string;
  className?: string;
};

export function RacePlannerLayout({
  planContent,
  settingsContent,
  mobileView,
  onMobileViewChange,
  planLabel,
  settingsLabel,
  className,
}: RacePlannerLayoutProps) {
  return (
    <div className={className}>
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
          <div className={mobileView === "plan" ? "space-y-6" : "hidden"}>{planContent}</div>
          <div className={mobileView === "settings" ? "space-y-6" : "hidden"}>{settingsContent}</div>
        </div>
      </div>

      <div className="hidden xl:grid xl:grid-cols-12 xl:gap-6">
        <div className="space-y-6 xl:col-span-8 2xl:col-span-9">{planContent}</div>
        <div className="space-y-6 xl:col-span-4 2xl:col-span-3 xl:sticky xl:top-4 xl:self-start">
          {settingsContent}
        </div>
      </div>
    </div>
  );
}
