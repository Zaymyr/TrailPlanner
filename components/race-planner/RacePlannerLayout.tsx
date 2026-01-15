"use client";

import type { ReactNode } from "react";
import { Button } from "../ui/button";

type RacePlannerLayoutProps = {
  planContent: ReactNode;
  planSecondaryContent?: ReactNode;
  settingsContent: ReactNode;
  mobileView: "plan" | "settings";
  onMobileViewChange: (view: "plan" | "settings") => void;
  planLabel: string;
  settingsLabel: string;
  summaryBarContent?: ReactNode;
  nutritionTrigger?: ReactNode;
  isSettingsCollapsed?: boolean;
  onSettingsToggle?: () => void;
  collapseSettingsLabel?: string;
  expandSettingsLabel?: string;
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
  summaryBarContent,
  nutritionTrigger,
  isSettingsCollapsed = false,
  onSettingsToggle,
  collapseSettingsLabel = "Hide panel",
  expandSettingsLabel = "Show panel",
  className,
}: RacePlannerLayoutProps) {
  const toggleLabel = isSettingsCollapsed ? expandSettingsLabel : collapseSettingsLabel;
  const toggleIconPath = isSettingsCollapsed ? "m9 18 6-6-6-6" : "m15 6-6 6 6 6";
  const hasSummaryBar = summaryBarContent || nutritionTrigger;
  return (
    <div className={className}>
      <div className="space-y-4 md:hidden">
        <div className="rounded-lg border border-border bg-card p-2 dark:border-slate-800 dark:bg-slate-900/60">
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

        {hasSummaryBar ? (
          <div className="sticky top-0 z-20 rounded-lg border border-border bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">{summaryBarContent}</div>
              {nutritionTrigger ? <div className="shrink-0">{nutritionTrigger}</div> : null}
            </div>
          </div>
        ) : null}

        <div className="space-y-6">
          <div className={mobileView === "plan" ? "space-y-6" : "hidden"}>
            <div className="space-y-6">{planContent}</div>
            {planSecondaryContent ? <div className="space-y-6">{planSecondaryContent}</div> : null}
          </div>
          <div className={mobileView === "settings" ? "space-y-6" : "hidden"}>{settingsContent}</div>
        </div>
      </div>

      <div className="hidden md:grid md:grid-cols-12 md:gap-6">
        <div
          className={
            isSettingsCollapsed
              ? "space-y-6 md:col-span-11 2xl:col-span-11"
              : "space-y-6 md:col-span-8 2xl:col-span-9"
          }
        >
          {planSecondaryContent ? (
            <div className="space-y-6 2xl:grid 2xl:grid-cols-[1.6fr,1fr] 2xl:items-start 2xl:gap-6 2xl:space-y-0">
              <div className="space-y-6">{planContent}</div>
              <div className="space-y-6">{planSecondaryContent}</div>
            </div>
          ) : (
            <div className="space-y-6">{planContent}</div>
          )}
        </div>
        <div
          className={
            isSettingsCollapsed
              ? "relative md:col-span-1 2xl:col-span-1 md:sticky md:top-4 md:self-start"
              : "relative space-y-6 md:col-span-4 2xl:col-span-3 md:sticky md:top-4 md:self-start"
          }
        >
          {onSettingsToggle ? (
            <Button
              type="button"
              variant="outline"
              className="absolute left-0 top-1/2 z-20 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-card/95 p-0 shadow-md backdrop-blur"
              onClick={onSettingsToggle}
              aria-label={toggleLabel}
              title={toggleLabel}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d={toggleIconPath} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span className="sr-only">{toggleLabel}</span>
            </Button>
          ) : null}
          {isSettingsCollapsed ? (
            <div className="min-h-[240px] rounded-xl border border-dashed border-border/60 bg-card/30" />
          ) : (
            settingsContent
          )}
        </div>
      </div>
    </div>
  );
}
