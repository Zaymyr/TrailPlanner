"use client";

import { useId, useState } from "react";

import { Input } from "../../../../components/ui/input";
import { cn } from "../../../../components/utils";
import type { AssignmentAutocompleteOption } from "./organizer-admin-model";

/** Searchable combobox of « Associer un organisateur » (account e-mail, course). */
export function AssignmentAutocomplete({
  id,
  value,
  options,
  placeholder,
  emptyMessage,
  inputType = "text",
  selectOnFocus = false,
  loading = false,
  onChange,
  onSelect,
}: {
  id: string;
  value: string;
  options: AssignmentAutocompleteOption[];
  placeholder: string;
  emptyMessage: string;
  inputType?: "text" | "email";
  selectOnFocus?: boolean;
  loading?: boolean;
  onChange: (value: string) => void;
  onSelect: (option: AssignmentAutocompleteOption) => void;
}) {
  const generatedId = useId();
  const listboxId = `${generatedId}-listbox`;
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectOption = (option: AssignmentAutocompleteOption) => {
    onSelect(option);
    setOpen(false);
    setHighlightedIndex(0);
  };

  return (
    <div className={cn("relative", open && "z-50")}>
      <Input
        id={id}
        type={inputType}
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && options[highlightedIndex] ? `${generatedId}-option-${highlightedIndex}` : undefined}
        value={value}
        placeholder={placeholder}
        onFocus={(event) => {
          if (selectOnFocus) event.currentTarget.select();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          onChange(event.target.value);
          setHighlightedIndex(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length > 0) {
            event.preventDefault();
            const direction = event.key === "ArrowDown" ? 1 : -1;
            setHighlightedIndex((current) => (current + direction + options.length) % options.length);
            setOpen(true);
            return;
          }
          if (event.key === "Enter" && open && options[highlightedIndex]) {
            event.preventDefault();
            selectOption(options[highlightedIndex]);
          }
        }}
        className="pr-9"
      />
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={cn("pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition", open && "rotate-180")}>
        <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {open ? (
        <div id={listboxId} role="listbox" className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-40 max-h-64 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-xl">
          {loading ? <p role="status" className="px-3 py-2 text-sm text-muted-foreground">Recherche…</p> : null}
          {!loading && options.length === 0 ? <p className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</p> : null}
          {!loading ? options.map((option, index) => (
            <button
              key={option.id}
              id={`${generatedId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={index === highlightedIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => selectOption(option)}
              className={cn("flex min-h-10 w-full flex-col items-start rounded px-3 py-2 text-left text-sm text-foreground", index === highlightedIndex ? "bg-brand-surface" : "hover:bg-muted/50")}
            >
              <span className="w-full truncate font-medium">{option.label}</span>
              {option.description ? <span className="w-full truncate text-xs text-muted-foreground">{option.description}</span> : null}
            </button>
          )) : null}
        </div>
      ) : null}
    </div>
  );
}
