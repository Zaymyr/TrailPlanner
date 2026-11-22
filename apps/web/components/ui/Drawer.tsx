"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "../utils";
import { getFocusableElements, trapTabKey } from "./focus-trap";

type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name of the panel (also the visible title unless `hideTitle`). */
  title: string;
  hideTitle?: boolean;
  description?: React.ReactNode;
  side?: "left" | "right";
  /** Tailwind width classes of the panel (default `w-full max-w-md`). */
  widthClassName?: string;
  /** Background and text colours of the panel (default `bg-card text-foreground`). */
  className?: string;
  /** Actions shown at the top of the panel, next to the close button. */
  actions?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Side panel (list + detail pattern of the admin console, mobile sidebar). Modal while open: focus moves
 * inside, Tab stays inside, Échap or the backdrop closes, and focus returns to the opener.
 */
export function Drawer({ open, onOpenChange, title, hideTitle, description, side = "right", widthClassName, className, actions, children }: DrawerProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    if (panel) (getFocusableElements(panel)[0] ?? panel).focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div aria-hidden="true" className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => onOpenChange(false)} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onOpenChange(false);
            return;
          }
          if (panelRef.current) trapTabKey(event, panelRef.current);
        }}
        className={cn(
          "absolute inset-y-0 flex flex-col overflow-hidden shadow-2xl outline-none",
          side === "left" ? "left-0" : "right-0",
          widthClassName ?? "w-full max-w-md",
          className ?? "bg-card text-foreground",
        )}
      >
        <div className={cn("flex items-start justify-between gap-3 px-5 pt-4", hideTitle ? "pb-0" : "pb-3")}>
          <div className={cn("min-w-0", hideTitle && "sr-only")}>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Fermer le panneau"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-current opacity-80 transition hover:bg-black/5 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring dark:hover:bg-white/10"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
