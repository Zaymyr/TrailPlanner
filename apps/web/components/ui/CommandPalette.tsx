"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "../utils";
import { filterCommandItems, groupCommandItems, moveActiveIndex, type CommandItem } from "./command-palette-filter";
import { trapTabKey } from "./focus-trap";

export type { CommandItem } from "./command-palette-filter";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Destinations and search results; filtered here with `filterCommandItems`. */
  items: CommandItem[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (item: CommandItem) => void;
  /** A server search is running (shown under the list). */
  loading?: boolean;
  placeholder?: string;
  emptyText?: string;
  limitPerGroup?: number;
};

/** ⌘K / Ctrl+K opens the palette from anywhere on the page. */
export function useCommandPaletteShortcut(onOpen: () => void) {
  React.useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onOpen]);
}

/** Search-and-go dialog: combobox input, grouped listbox, ↑ ↓ Entrée Échap. */
export function CommandPalette({
  open,
  onOpenChange,
  items,
  query,
  onQueryChange,
  onSelect,
  loading = false,
  placeholder = "Rechercher…",
  emptyText = "Aucun résultat.",
  limitPerGroup,
}: CommandPaletteProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();
  const titleId = React.useId();
  const filtered = React.useMemo(() => filterCommandItems(items, query, { limitPerGroup }), [items, query, limitPerGroup]);
  const groups = React.useMemo(() => groupCommandItems(filtered), [filtered]);
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    setActiveIndex(filtered.length ? 0 : -1);
  }, [query, filtered.length]);

  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, [open]);

  React.useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(`${listId}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listId]);

  if (!open || typeof document === "undefined") return null;

  const optionId = (index: number) => `${listId}-option-${index}`;
  const choose = (item: CommandItem | undefined) => {
    if (!item) return;
    onSelect(item);
    onOpenChange(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || ((event.key === "Home" || event.key === "End") && event.ctrlKey)) {
      event.preventDefault();
      setActiveIndex((current) => moveActiveIndex(current, filtered.length, event.key as "ArrowDown" | "ArrowUp" | "Home" | "End"));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      choose(filtered[activeIndex]);
      return;
    }
    if (panelRef.current) trapTabKey(event, panelRef.current);
  };

  let index = -1;
  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-start justify-center px-4 pt-[12vh]">
      <div aria-hidden="true" className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="relative z-10 flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl"
      >
        <h2 id={titleId} className="sr-only">
          Palette de commandes
        </h2>
        <div className="flex items-center gap-2 border-b border-border px-4">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-muted-foreground">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            aria-label={placeholder}
            placeholder={placeholder}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline">Échap</kbd>
        </div>
        <div id={listId} role="listbox" aria-label="Résultats" className="min-h-0 flex-1 overflow-y-auto py-2">
          {groups.length === 0 && !loading ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">{emptyText}</p> : null}
          {groups.map((group) => (
            <div key={group.group} role="group" aria-label={group.group} className="py-1">
              <p aria-hidden="true" className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.group}
              </p>
              {group.items.map((item) => {
                index += 1;
                const itemIndex = index;
                const active = itemIndex === activeIndex;
                return (
                  <div
                    key={item.id}
                    id={optionId(itemIndex)}
                    role="option"
                    aria-selected={active}
                    onMouseMove={() => setActiveIndex(itemIndex)}
                    onClick={() => choose(item)}
                    className={cn(
                      "mx-2 flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm",
                      active ? "bg-brand-surface text-foreground dark:bg-emerald-950/60" : "text-foreground",
                    )}
                  >
                    <span className="min-w-0 truncate">{item.label}</span>
                    {item.hint ? <span className="shrink-0 text-xs text-muted-foreground">{item.hint}</span> : null}
                  </div>
                );
              })}
            </div>
          ))}
          {loading ? <p className="px-4 py-2 text-xs text-muted-foreground" aria-live="polite">Recherche…</p> : null}
        </div>
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">↑ ↓ pour choisir · Entrée pour ouvrir · Échap pour fermer</p>
      </div>
    </div>,
    document.body,
  );
}
