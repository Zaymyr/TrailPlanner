"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import type { OnboardingTranslations } from "../../locales/types";

type SpotlightRect = { x: number; y: number; width: number; height: number };

type Props = {
  open: boolean;
  step: number;
  copy: OnboardingTranslations;
  /** DOM element ID to highlight for this step, or null for no highlight */
  targetId: string | null;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
};

const PAD = 12;           // padding around the spotlight cutout
const MODAL_H = 290;      // approximate modal height for positioning
const GAP = 18;           // gap between spotlight and modal card
const SETTLE_MS = 430;    // time to wait for smooth-scroll to finish

export function OnboardingOverlay({ open, step, copy, targetId, onClose, onNext, onPrevious }: Props) {
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (!open) {
      setSpotlight(null);
      return;
    }

    // Lock user scroll while tutorial is active
    const prevent = (e: Event) => e.preventDefault();
    window.addEventListener("wheel", prevent, { passive: false });
    window.addEventListener("touchmove", prevent, { passive: false });

    // Clear stale spotlight while scrolling to next target
    setSpotlight(null);

    let timer: ReturnType<typeof setTimeout> | null = null;

    const rafId = requestAnimationFrame(() => {
      if (!targetId) {
        // No target: scroll to top so the page looks tidy
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // RacePlannerLayout renders the same content in both a mobile div
      // (xl:hidden) and a desktop div (hidden xl:grid), giving each target
      // element two DOM nodes with the same id.  getElementById always returns
      // the first one, which is the mobile node – hidden on desktop via its
      // parent's xl:hidden class – so getBoundingClientRect() returns zeros.
      // We therefore query *all* matching nodes and pick the first visible one.
      const findVisible = (id: string): Element | null => {
        const nodes = document.querySelectorAll(`[id="${id}"]`);
        for (const node of Array.from(nodes)) {
          const r = node.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return node;
        }
        return null;
      };

      const target = findVisible(targetId);
      if (!target) return;

      // Scroll so the element sits PAD + 8 px below the viewport top,
      // leaving room for the spotlight ring (-PAD offset) to be fully visible.
      const SCROLL_MARGIN = PAD + 8;
      const rectBefore = target.getBoundingClientRect();
      const scrollTarget = Math.max(0, window.scrollY + rectBefore.top - SCROLL_MARGIN);
      window.scrollTo({ top: scrollTarget, behavior: "smooth" });

      // Only measure the rect AFTER the scroll animation has settled,
      // and re-query to pick up the visible instance at the new scroll position.
      timer = setTimeout(() => {
        const visible = findVisible(targetId);
        if (!visible) return;
        const r = visible.getBoundingClientRect();
        setSpotlight({ x: r.x, y: r.y, width: r.width, height: r.height });
      }, SETTLE_MS);
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (timer !== null) clearTimeout(timer);
      window.removeEventListener("wheel", prevent);
      window.removeEventListener("touchmove", prevent);
    };
  }, [open, step, targetId]);

  if (!open) return null;

  const totalSteps = copy.steps.length;
  const currentStep = copy.steps[step];
  const isFirst = step === 0;
  const isLast = step === totalSteps - 1;

  const stepLabel = copy.stepOf
    .replace("{current}", String(step + 1))
    .replace("{total}", String(totalSteps));

  // Decide where to pin the modal card
  // – When a spotlight is active: place it just below (or above if no room)
  // – When no spotlight: center it on screen
  let modalTop: number | null = null;
  if (spotlight) {
    const vh = window.innerHeight;
    const below = spotlight.y + spotlight.height + PAD + GAP;
    if (below + MODAL_H <= vh - 8) {
      modalTop = below;
    } else {
      modalTop = Math.max(8, spotlight.y - PAD - MODAL_H - GAP);
    }
  }

  const cardClass =
    "pointer-events-auto relative w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900/90";

  const cardContent = (
    <>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between pr-8">
        <span className="text-xs font-medium text-muted-foreground">{stepLabel}</span>
        <Button
          type="button"
          variant="ghost"
          className="absolute right-2 top-2 h-8 w-8 p-0 text-lg text-foreground dark:text-slate-200"
          aria-label={copy.closeLabel}
          onClick={onClose}
        >
          ×
        </Button>
      </div>

      {/* Content */}
      <h2 className="text-xl font-semibold text-foreground dark:text-slate-50">{currentStep.title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{currentStep.description}</p>

      {/* Progress dots */}
      <div className="mt-6 flex items-center justify-center gap-2">
        {copy.steps.map((_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === step ? "bg-primary" : i < step ? "bg-primary/40" : "bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between">
        <div>
          {!isFirst && (
            <Button type="button" variant="ghost" onClick={onPrevious}>
              {copy.previous}
            </Button>
          )}
        </div>
        <Button type="button" onClick={onNext}>
          {isLast ? copy.finish : copy.next}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* ── Backdrop with spotlight cutout ── */}
      <svg
        className="pointer-events-none fixed inset-0 z-50 h-full w-full"
        aria-hidden="true"
      >
        {spotlight ? (
          <defs>
            <mask id="tutorial-spotlight-mask">
              {/* White = show backdrop colour, black = transparent (the cutout) */}
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={spotlight.x - PAD}
                y={spotlight.y - PAD}
                width={spotlight.width + PAD * 2}
                height={spotlight.height + PAD * 2}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
        ) : null}
        <rect
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.78)"
          mask={spotlight ? "url(#tutorial-spotlight-mask)" : undefined}
        />
      </svg>

      {/* ── Highlight ring around the target ── */}
      {spotlight ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 rounded-lg tutorial-spotlight-ring"
          style={{
            left: spotlight.x - PAD,
            top: spotlight.y - PAD,
            width: spotlight.width + PAD * 2,
            height: spotlight.height + PAD * 2,
          }}
        />
      ) : null}

      {/* ── Modal card ── */}
      {spotlight ? (
        // Positioned close to the highlighted element
        <div
          className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
          style={{ top: modalTop ?? 0 }}
        >
          <div className={cardClass}>{cardContent}</div>
        </div>
      ) : (
        // No spotlight → center on screen
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className={cardClass}>{cardContent}</div>
        </div>
      )}
    </>
  );
}
