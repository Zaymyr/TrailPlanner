"use client";

import { Button } from "../ui/button";
import type { OnboardingTranslations } from "../../locales/types";

type Props = {
  open: boolean;
  step: number;
  copy: OnboardingTranslations;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
};

export function OnboardingOverlay({ open, step, copy, onClose, onNext, onPrevious }: Props) {
  if (!open) return null;

  const totalSteps = copy.steps.length;
  const currentStep = copy.steps[step];
  const isFirst = step === 0;
  const isLast = step === totalSteps - 1;

  const stepLabel = copy.stepOf
    .replace("{current}", String(step + 1))
    .replace("{total}", String(totalSteps));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
      <div className="relative w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900/90">
        {/* Header row */}
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

        {/* Footer row */}
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
  );
}
