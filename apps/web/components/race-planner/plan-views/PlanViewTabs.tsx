"use client";

import React, { useRef, type KeyboardEvent } from "react";

import type { PlanLocale } from "./format";

export type PlanView = "stations" | "pace" | "chronology";

export type PlanViewTabsProps = {
  value: PlanView;
  onChange: (value: PlanView) => void;
  locale: PlanLocale;
  counts?: { stations?: number; sections?: number };
};

const order: PlanView[] = ["stations", "pace", "chronology"];

const labels: Record<PlanLocale, Record<PlanView, string>> = {
  fr: { stations: "Ravitos", pace: "Allures", chronology: "Chronologie" },
  en: { stations: "Aid stations", pace: "Pace", chronology: "Timeline" },
};

const ariaLabel: Record<PlanLocale, string> = { fr: "Vues du plan", en: "Plan views" };

/** DOM ids shared with the panels: render each panel with `id={planViewPanelId(v)}` and `aria-labelledby={planViewTabId(v)}`. */
export const planViewTabId = (view: PlanView) => `plan-view-tab-${view}`;
export const planViewPanelId = (view: PlanView) => `plan-view-panel-${view}`;

export function PlanViewTabs({ value, onChange, locale, counts }: PlanViewTabsProps) {
  const refs = useRef<Partial<Record<PlanView, HTMLButtonElement | null>>>({});

  const focusAndSelect = (view: PlanView) => {
    onChange(view);
    refs.current[view]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % order.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + order.length) % order.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = order.length - 1;
    if (next === null) return;
    event.preventDefault();
    focusAndSelect(order[next]);
  };

  const countFor = (view: PlanView) =>
    view === "stations" ? counts?.stations : view === "pace" ? counts?.sections : undefined;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel[locale]}
      className="flex w-full gap-1 rounded-full bg-[#ECEAE3] p-1 print:hidden"
    >
      {order.map((view, index) => {
        const selected = view === value;
        const count = countFor(view);
        return (
          <button
            key={view}
            ref={(node) => {
              refs.current[view] = node;
            }}
            type="button"
            role="tab"
            id={planViewTabId(view)}
            aria-selected={selected}
            aria-controls={planViewPanelId(view)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(view)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D5016] ${
              selected ? "bg-[#2D5016] text-[#FAF8F2] shadow-[0_1px_0_rgba(31,36,16,0.18)]" : "text-[#5C6450] hover:text-[#1F2410]"
            }`}
          >
            <span className="truncate">{labels[locale][view]}</span>
            {typeof count === "number" ? (
              <span
                className={`font-[family-name:var(--font-plan-mono)] text-[11px] font-bold tabular-nums ${
                  selected ? "text-[#C8D44E]" : "text-[#8A917E]"
                }`}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
