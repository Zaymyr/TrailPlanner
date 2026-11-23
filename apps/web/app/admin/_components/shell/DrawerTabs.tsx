"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "../../../../components/utils";

export type DrawerTab<T extends string> = { id: T; label: string; count?: number };

/**
 * Tabs of a detail panel (runner and edition profiles): ARIA tablist, arrow / Home / End keys move
 * between tabs, the panel is labelled by its tab. Sticky under the panel header, scrolls sideways on
 * a narrow screen instead of widening the page.
 */
export function DrawerTabs<T extends string>({ tabs, active, onChange, label, children }: {
  tabs: DrawerTab<T>[];
  active: T;
  onChange: (tab: T) => void;
  label: string;
  children: ReactNode;
}) {
  const baseId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, tabs.findIndex((tab) => tab.id === active));

  const move = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = tabs.length - 1;
    const target = event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
        : event.key === "Home" ? 0
          : event.key === "End" ? last
            : null;
    if (target === null) return;
    event.preventDefault();
    onChange(tabs[target].id);
    refs.current[target]?.focus();
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div role="tablist" aria-label={label} className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border bg-card px-4">
        {tabs.map((tab, tabIndex) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(element) => { refs.current[tabIndex] = element; }}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={move}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                selected ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count ? <span className="rounded-full bg-muted px-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">{tab.count}</span> : null}
            </button>
          );
        })}
      </div>
      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${tabs[index]?.id}`} tabIndex={0} className="px-5 py-4 focus-visible:outline-none">
        {children}
      </div>
    </div>
  );
}

/** Label / value rows of a detail panel. */
export function DetailList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Titled block inside a detail panel. */
export function DetailSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
