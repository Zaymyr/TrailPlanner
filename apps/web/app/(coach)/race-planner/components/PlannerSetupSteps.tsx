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
  openStep: PlannerSetupStepId;
  onOpenStep: (step: PlannerSetupStepId) => void;
};

export function PlannerSetupSteps({ ariaLabel, steps, openStep, onOpenStep }: PlannerSetupStepsProps) {
  return (
    <div className="space-y-4">
      <nav aria-label={ariaLabel}>
        <ol className="grid gap-2 sm:grid-cols-3">
          {steps.map((step, index) => {
            const isOpen = step.id === openStep;

            return (
              <li key={step.id}>
                <button
                  type="button"
                  aria-current={isOpen ? "step" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${
                    isOpen
                      ? "border-blue-600 bg-blue-50 text-blue-950 shadow-sm dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-50"
                      : "border-border bg-card text-muted-foreground hover:border-blue-300 hover:text-foreground dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-blue-500/60"
                  }`}
                  onClick={() => onOpenStep(step.id)}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      isOpen
                        ? "bg-blue-600 text-white dark:bg-blue-400 dark:text-blue-950"
                        : "bg-muted text-foreground dark:bg-slate-800 dark:text-slate-100"
                    }`}
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{step.title}</span>
                    <span className="block truncate text-xs opacity-80">{step.summary}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="space-y-3">
        {steps.map((step, index) => {
          const isOpen = step.id === openStep;
          const titleId = `planner-setup-${step.id}-title`;
          const contentId = `planner-setup-${step.id}-content`;

          return (
            <section
              key={step.id}
              className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm dark:border-slate-800 dark:bg-slate-950/70"
            >
              <h2 id={titleId}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/40 dark:hover:bg-slate-900/50"
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  onClick={() => onOpenStep(step.id)}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-600/70 bg-blue-50 text-sm font-semibold text-blue-900 dark:border-blue-400/70 dark:bg-blue-900/30 dark:text-blue-50">
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
