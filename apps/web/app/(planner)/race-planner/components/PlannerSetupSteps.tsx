"use client";

import type { ReactNode } from "react";

export type PlannerSetupStepId = "course" | "pacing" | "nutrition";

type PlannerSetupStep = {
  id: PlannerSetupStepId;
  title: string;
  summary: string;
  content: ReactNode;
};

type PlannerSetupStepsProps = {
  ariaLabel: string;
  steps: PlannerSetupStep[];
  openStep: PlannerSetupStepId | null;
  onOpenStep: (step: PlannerSetupStepId | null) => void;
};

export function PlannerSetupSteps({ ariaLabel, steps, openStep, onOpenStep }: PlannerSetupStepsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3" aria-label={ariaLabel}>
        {steps.map((step, index) => {
          const isOpen = step.id === openStep;
          const titleId = `planner-setup-${step.id}-title`;
          const contentId = `planner-setup-${step.id}-content`;

          return (
            <section
              key={step.id}
              className="overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-[0_12px_32px_rgba(45,80,22,0.06)] dark:border-slate-800 dark:bg-slate-950/70"
            >
              <h2 id={titleId}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-brand-surface/60 dark:hover:bg-slate-900/50"
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  onClick={() => onOpenStep(isOpen ? null : step.id)}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-surface text-sm font-semibold text-brand dark:border-emerald-400/70 dark:bg-emerald-950/40 dark:text-emerald-50">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-foreground dark:text-slate-50">
                      {step.title}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground dark:text-slate-400">
                      {step.summary}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground" aria-hidden="true">
                    {isOpen ? "-" : "+"}
                  </span>
                </button>
              </h2>
              {isOpen ? (
                <div id={contentId} role="region" aria-labelledby={titleId} className="border-t border-border/60 p-3 sm:p-4">
                  {step.content}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
