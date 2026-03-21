"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import type { OnboardingTranslations } from "../../locales/types";

type SpotlightRect = { x: number; y: number; width: number; height: number };

type Props = {
  open: boolean;
  step: number;
  copy: OnboardingTranslations;
  /** ID of the DOM element to highlight for the current step, or null for no highlight */
  targetId: string | null;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
};

const SPOTLIGHT_PADDING = 12;
const SCROLL_SETTLE_MS = 380;

export function OnboardingOverlay({ open, step, copy, targetId, onClose, onNext, onPrevious }: Props) {
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (!open) {
      setSpotlight(null);
      return;
    }

    // Lock user scroll (wheel + touch). window.scrollTo() still works programmatically.
    const prevent = (e: Event) => e.preventDefault();
    window.addEventListener("wheel", prevent, { passive: false });
    window.addEventListener("touchmove", prevent, { passive: false });

    let updateTimer: ReturnType<typeof setTimeout> | null = null;

    const rafId = requestAnimationFrame(() => {
      if (!targetId) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        setSpotlight(null);
        return;
      }

      const target = document.getElementById(targetId);
      if (!target) {
        setSpotlight(null);
        return;
      }

      // Scroll so the element sits near the top, well above the bottom modal
      const rect = target.getBoundingClientRect();
      const elementTop = rect.top + window.scrollY;
      window.scrollTo({ top: Math.max(0, elementTop - 24), behavior: "smooth" });

      // Set initial spotlight position (before scroll settles)
      setSpotlight({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });

      // Re-measure after scroll animation completes so spotlight lands correctly
      updateTimer = setTimeout(() => {
        const updated = target.getBoundingClientRect();
        setSpotlight({ x: updated.x, y: updated.y, width: updated.width, height: updated.height });
      }, SCROLL_SETTLE_MS);
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (updateTimer !== null) clearTimeout(updateTimer);
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

  return (
    <>
      {/* SVG backdrop with spotlight cutout */}
      <svg
        className="pointer-events-none fixed inset-0 z-50 h-full w-full"
        aria-hidden="true"
      >
        {spotlight ? (
          <defs>
            <mask id="tutorial-spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={spotlight.x - SPOTLIGHT_PADDING}
                y={spotlight.y - SPOTLIGHT_PADDING}
                width={spotlight.width + SPOTLIGHT_PADDING * 2}
                height={spotlight.height + SPOTLIGHT_PADDING * 2}
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

      {/* Highlight outline around the target element */}
      {spotlight ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 rounded-lg ring-2 ring-primary ring-offset-1"
          style={{
            left: spotlight.x - SPOTLIGHT_PADDING,
            top: spotlight.y - SPOTLIGHT_PADDING,
            width: spotlight.width + SPOTLIGHT_PADDING * 2,
            height: spotlight.height + SPOTLIGHT_PADDING * 2,
          }}
        />
      ) : null}

      {/* Modal card pinned to the bottom */}
      <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center px-4 pb-6">
        <div className="pointer-events-auto relative w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900/90">
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
          <h2 className="text-xl font-semibold text-foreground dark:text-slate-50">
            {currentStep.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {currentStep.description}
          </p>

          {/* Progress dots */}
          <div className="mt-6 flex items-center justify-center gap-2">
            {copy.steps.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === step
                    ? "bg-primary"
                    : i < step
                      ? "bg-primary/40"
                      : "bg-muted-foreground/30"
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
        </div>
      </div>
    </>
  );
}
