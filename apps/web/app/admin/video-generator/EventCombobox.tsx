"use client";

import React, { useEffect, useId, useMemo, useState } from "react";

import { filterEventChoices } from "./video-generator-catalog";

export type EventComboboxChoice = { id: string; name: string; detail?: string | null };

type EventComboboxProps = {
  choices: EventComboboxChoice[];
  disabled?: boolean;
  inputId: string;
  onChange: (eventId: string) => void;
  value: string;
};

/**
 * Event picker that filters while typing (accents and case ignored), with a short detail per
 * event such as its number of videos. Arrow keys move, Enter picks, Escape restores the choice.
 */
export function EventCombobox({ choices, disabled, inputId, onChange, value }: EventComboboxProps) {
  const listId = useId();
  const selected = choices.find((choice) => choice.id === value) ?? null;
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filtered = useMemo(
    // The selected name in the field shows every event again, not only itself.
    () => (selected && query === selected.name ? choices : filterEventChoices(choices, query)),
    [choices, query, selected],
  );

  useEffect(() => {
    setQuery(selected?.name ?? "");
  }, [selected?.name]);

  const pick = (choice: EventComboboxChoice) => {
    onChange(choice.id);
    setQuery(choice.name);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[activeIndex] ? `${listId}-${filtered[activeIndex].id}` : undefined}
        autoComplete="off"
        className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        placeholder="Rechercher un événement…"
        disabled={disabled}
        value={query}
        onFocus={(event) => {
          event.target.select();
          setOpen(true);
        }}
        onBlur={() => {
          // Let a click on an option land before closing; a typed text that picked nothing is undone.
          window.setTimeout(() => {
            setOpen(false);
            setQuery(selected?.name ?? "");
          }, 120);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActiveIndex((index) => (filtered.length ? (index + step + filtered.length) % filtered.length : 0));
          } else if (event.key === "Enter" && open && filtered[activeIndex]) {
            event.preventDefault();
            pick(filtered[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
            setQuery(selected?.name ?? "");
          }
        }}
      />
      {open && !disabled ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-card py-1 text-sm shadow-lg"
        >
          {filtered.length === 0 ? <li className="px-3 py-2 text-xs text-muted-foreground">Aucun événement ne correspond.</li> : null}
          {filtered.map((choice, index) => (
            <li
              key={choice.id}
              id={`${listId}-${choice.id}`}
              role="option"
              aria-selected={choice.id === value}
              className={`cursor-pointer px-3 py-1.5 ${index === activeIndex ? "bg-muted" : ""} ${choice.id === value ? "font-semibold" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => pick(choice)}
            >
              <span className="block truncate">{choice.name}</span>
              {choice.detail ? <span className="block text-[11px] text-muted-foreground">{choice.detail}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
