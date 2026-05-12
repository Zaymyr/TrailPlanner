"use client";

import type { ReactNode } from "react";
import { Button } from "../ui/button";

type RacePlannerLayoutProps = {
  planContent: ReactNode;
  planSecondaryContent?: ReactNode;
  settingsContent: ReactNode;
  floatingFooter?: ReactNode;
  mobileView: "plan" | "settings";
  onMobileViewChange: (view: "plan" | "settings") => void;
  planLabel: string;
  settingsLabel: string;
  isSettingsCollapsed?: boolean;
  onSettingsToggle?: () => void;
  settingsCount?: number;
  collapseSettingsLabel?: string;
  expandSettingsLabel?: string;
  className?: string;
};

export function RacePlannerLayout({
  planContent,
  planSecondaryContent,
  settingsContent,
  floatingFooter,
  mobileView,
  onMobileViewChange,
  planLabel,
  settingsLabel,
  isSettingsCollapsed = false,
  onSettingsToggle,
  settingsCount = 0,
  collapseSettingsLabel = "Hide panel",
  expandSettingsLabel = "Show panel",
  className,
}: RacePlannerLayoutProps) {
  const toggleLabel = isSettingsCollapsed ? expandSettingsLabel : collapseSettingsLabel;
  const toggleIconPath = isSettingsCollapsed ? "m9 18 6-6-6-6" : "m15 6-6 6 6 6";
  const footerOffsetClass = floatingFooter ? "pb-28" : "";
  return (
    <div className={className}>
      <div className="space-y-4 xl:hidden">
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

        <div className={`space-y-6 ${footerOffsetClass}`}>
          {mobileView === "plan" ? (
            <div className="space-y-6">
              <div className="space-y-6">{planContent}</div>
              {planSecondaryContent ? <div className="space-y-6">{planSecondaryContent}</div> : null}
            </div>
          ) : null}
          {mobileView === "settings" ? <div className="space-y-6">{settingsContent}</div> : null}
          {floatingFooter ? <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 xl:hidden">{floatingFooter}</div> : null}
        </div>
      </div>

      <div
        className={
          isSettingsCollapsed
            ? "hidden xl:grid xl:grid-cols-[minmax(0,1fr)_40px] xl:gap-4"
            : "hidden xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(320px,24rem)] xl:gap-6"
        }
      >
        <div
          className={`space-y-6 ${footerOffsetClass}`}
        >
          {planSecondaryContent ? (
            <div className="space-y-6 2xl:grid 2xl:grid-cols-[1.6fr,1fr] 2xl:items-start 2xl:gap-6 2xl:space-y-0">
              <div className="space-y-6">{planContent}</div>
              <div className="space-y-6">{planSecondaryContent}</div>
            </div>
          ) : (
            <div className="space-y-6">{planContent}</div>
          )}
          {floatingFooter ? (
            <div className="fixed bottom-6 right-6 z-50 hidden w-[min(420px,calc(100vw-3rem))] xl:block">
              {floatingFooter}
            </div>
          ) : null}
        </div>
        <div
          className={
            isSettingsCollapsed
              ? "relative w-10 xl:sticky xl:top-4 xl:self-start"
              : "relative space-y-6 xl:sticky xl:top-4 xl:self-start"
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
            <div className="flex min-h-[240px] w-10 flex-col items-center gap-3 rounded-xl border border-border/60 bg-card/60 py-3 text-muted-foreground shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M5 5.5h14M5 12h14M5 18.5h14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-900 dark:bg-blue-900/40 dark:text-blue-50">
                {settingsCount}
              </span>
              <span className="sr-only">{settingsLabel}</span>
            </div>
          ) : (
            settingsContent
          )}
        </div>
      </div>
    </div>
  );
}
