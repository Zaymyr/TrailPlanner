"use client";

import { Fragment, type ReactNode } from "react";
import { NutritionIcon, PaceIcon, TrailIcon } from "@pace-yourself/design-system/icons";

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

const STEP_ICONS: Record<PlannerSetupStepId, typeof TrailIcon> = {
  course: TrailIcon,
  pacing: PaceIcon,
  nutrition: NutritionIcon,
};

const NUMBER_PATTERN = /(\d+(?:[.,:  ]\d+)*)/;

/**
 * Renders the numbers of an already formatted string in the plan mono face
 * (tabular figures) without touching the wording.
 */
export function withMonoNumbers(text: string): ReactNode {
  return text.split(NUMBER_PATTERN).map((part, index) =>
    index % 2 === 1 ? (
      <span
        key={index}
        className="font-[family-name:var(--font-plan-mono)] font-medium tabular-nums text-[#1F2410]"
      >
        {part}
      </span>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  );
}

/**
 * The three plan settings (course, pacing, nutrition targets) read as a quiet
 * "réglages" sheet: numbered posts on a dotted trail rail, one open at a time.
 */
export function PlannerSetupSteps({ ariaLabel, steps, openStep, onOpenStep }: PlannerSetupStepsProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E2D8] bg-[#FAF8F2]" aria-label={ariaLabel}>
      {steps.map((step, index) => {
        const isOpen = step.id === openStep;
        const isFirst = index === 0;
        const isLast = index === steps.length - 1;
        const titleId = `planner-setup-${step.id}-title`;
        const contentId = `planner-setup-${step.id}-content`;
        const StepIcon = STEP_ICONS[step.id];

        return (
          <section
            key={step.id}
            className={`relative transition-colors ${isOpen ? "bg-white" : ""} ${
              isFirst
                ? ""
                : "before:absolute before:left-14 before:right-0 before:top-0 before:h-px before:bg-[#E5E2D8] sm:before:left-[60px]"
            }`}
          >
            {/* Dotted trail rail joining the step posts. */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute left-[31px] w-0 border-l-2 border-dotted border-[#B5CC9A] sm:left-[35px] ${
                isFirst ? "top-8" : "top-0"
              } ${isLast ? "h-8" : "bottom-0"} ${isFirst && isLast ? "hidden" : ""}`}
            />
            <h2 id={titleId}>
              <button
                type="button"
                className="group relative flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#2D5016] sm:px-5"
                aria-expanded={isOpen}
                aria-controls={contentId}
                onClick={() => onOpenStep(isOpen ? null : step.id)}
              >
                <span
                  className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-[family-name:var(--font-plan-mono)] text-[13px] font-semibold tabular-nums transition-colors ${
                    isOpen
                      ? "border-[#2D5016] bg-[#2D5016] text-[#FAF8F2]"
                      : "border-[#B5CC9A] bg-[#FAF8F2] text-[#2D5016] group-hover:border-[#2D5016]"
                  }`}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 pt-0.5">
                  <span className="flex items-center gap-2">
                    <StepIcon size={16} strokeWidth={1.8} color={isOpen ? "#2D5016" : "#5C6450"} />
                    <span className="font-[family-name:var(--font-plan-display)] text-[16px] font-semibold leading-6 tracking-[-0.01em] text-[#1F2410]">
                      {step.title}
                    </span>
                  </span>
                  <span className={`mt-0.5 block text-[13px] leading-5 text-[#5C6450] ${isOpen ? "" : "truncate"}`}>
                    {withMonoNumbers(step.summary)}
                  </span>
                </span>
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isOpen
                      ? "border-[#2D5016] bg-[#E8F0E0] text-[#2D5016]"
                      : "border-[#E5E2D8] bg-white text-[#5C6450] group-hover:border-[#B5CC9A] group-hover:text-[#2D5016]"
                  }`}
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  >
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </span>
              </button>
            </h2>
            {isOpen ? (
              <div
                id={contentId}
                role="region"
                aria-labelledby={titleId}
                className="relative z-[1] bg-white px-3 pb-5 sm:bg-transparent sm:pl-[60px] sm:pr-5"
              >
                {step.content}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
