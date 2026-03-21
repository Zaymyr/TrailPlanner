"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import type { OnboardingTranslations } from "../../locales/types";

// Maps each step index to an existing element ID in the DOM.
// null = no spotlight (card stays centered).
const STEP_TARGET_IDS: (string | null)[] = [
  null,                     // Step 0: Welcome – no specific element
  "course-profile",         // Step 1: Import GPX / Browse races buttons
  "pacing-section",         // Step 2: Pace & nutrition inputs
  "onboarding-add-ravito",  // Step 3: "Add an aid station" button
  "onboarding-supply-btn",  // Step 4: "+" supply button on the first station
  "onboarding-account",     // Step 5: Save plan / account section
];

const PADDING = 8;   // px of breathing room around the spotlight
const CARD_W = 380;  // max width of the tooltip card
const CARD_GAP = 14; // gap between spotlight and card
const MARGIN = 16;   // min distance from viewport edges

type Props = {
  open: boolean;
  step: number;
  copy: OnboardingTranslations;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
};

export function OnboardingOverlay({ open, step, copy, onClose, onNext, onPrevious }: Props) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [vpW, setVpW] = useState(0);
  const [vpH, setVpH] = useState(0);

  useEffect(() => {
    if (!open) return;

    setVpW(window.innerWidth);
    setVpH(window.innerHeight);

    const id = STEP_TARGET_IDS[step] ?? null;
    if (!id) {
      setTargetRect(null);
      return;
    }

    // The layout renders content twice (mobile + desktop containers with the same IDs).
    // getElementById returns the first match, which may be inside a display:none container.
    // querySelectorAll + offsetParent check finds the actually-visible element instead.
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(`#${id}`));
    const el = candidates.find((c) => c.offsetParent !== null) ?? candidates[0] ?? null;
    if (!el) {
      setTargetRect(null);
      return;
    }

    // Scroll the target into view, then capture its rect once the scroll settles
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      // Guard: if the rect is zero the element is still hidden — fall back to centered card
      setTargetRect(rect.width > 0 || rect.height > 0 ? rect : null);
    }, 500);
    return () => clearTimeout(timer);
  }, [open, step]);

  if (!open) return null;

  const totalSteps = copy.steps.length;
  const currentStep = copy.steps[step];
  const isFirst = step === 0;
  const isLast = step === totalSteps - 1;

  const stepLabel = copy.stepOf
    .replace("{current}", String(step + 1))
    .replace("{total}", String(totalSteps));

  // Spotlight dimensions (with padding)
  const spotX = targetRect ? targetRect.left - PADDING : 0;
  const spotY = targetRect ? targetRect.top - PADDING : 0;
  const spotW = targetRect ? targetRect.width + PADDING * 2 : 0;
  const spotH = targetRect ? targetRect.height + PADDING * 2 : 0;

  // Card positioning: prefer above when target is in lower half, below otherwise.
  // Always clamp so the card stays fully within the viewport.
  let cardStyle: React.CSSProperties;
  const effectiveCardW = Math.min(CARD_W, vpW - MARGIN * 2);
  const estimatedCardH = 260;

  if (!targetRect) {
    cardStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: effectiveCardW,
    };
  } else {
    const spotBottom = spotY + spotH;
    const spotMidY = spotY + spotH / 2;
    const spaceBelow = vpH - spotBottom;
    const spaceAbove = spotY;

    let top: number;
    if (spotMidY > vpH / 2) {
      // Target in lower half — prefer showing card above
      top = spaceAbove >= estimatedCardH + CARD_GAP
        ? spotY - estimatedCardH - CARD_GAP
        : spotBottom + CARD_GAP;
    } else {
      // Target in upper half — prefer showing card below
      top = spaceBelow >= estimatedCardH + CARD_GAP
        ? spotBottom + CARD_GAP
        : spotY - estimatedCardH - CARD_GAP;
    }

    // Final clamp: keep card within viewport regardless of decision above
    top = Math.max(MARGIN, Math.min(top, vpH - estimatedCardH - MARGIN));

    // Align left edge with target, clamped to viewport
    const left = Math.max(MARGIN, Math.min(spotX, vpW - effectiveCardW - MARGIN));

    cardStyle = { position: "fixed", top, left, width: effectiveCardW };
  }

  return (
    <>
      {/* Dark backdrop with spotlight hole via SVG mask */}
      {targetRect ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50"
          style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%" }}
        >
          <defs>
            <mask id="onboarding-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect x={spotX} y={spotY} width={spotW} height={spotH} rx="6" fill="black" />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(15, 23, 42, 0.80)"
            mask="url(#onboarding-mask)"
          />
        </svg>
      ) : (
        <div className="fixed inset-0 z-50 bg-slate-950/75" />
      )}

      {/* Pulsing emerald ring around the highlighted element */}
      {targetRect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 animate-pulse rounded-md ring-2 ring-emerald-400 ring-offset-1"
          style={{ left: spotX, top: spotY, width: spotW, height: spotH }}
        />
      )}

      {/* Tooltip card */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed z-50 rounded-lg border border-border bg-card shadow-2xl dark:border-slate-800 dark:bg-slate-900/95"
        style={cardStyle}
      >
        <div className="p-5">
          {/* Header: step counter + close */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{stepLabel}</span>
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-8 p-0 text-lg text-foreground dark:text-slate-200"
              aria-label={copy.closeLabel}
              onClick={onClose}
            >
              ×
            </Button>
          </div>

          {/* Step content */}
          <h2 className="text-base font-semibold text-foreground dark:text-slate-50">
            {currentStep.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {currentStep.description}
          </p>

          {/* Progress dots */}
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {copy.steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === step
                    ? "bg-primary"
                    : i < step
                      ? "bg-primary/40"
                      : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="mt-4 flex items-center justify-between">
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
