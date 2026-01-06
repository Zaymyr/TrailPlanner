import type { SVGProps } from "react";

import type { LandingPageTranslations } from "../../locales/types";

const IconMap = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
    <path
      d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M9 4v14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    <path d="M15 6v14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
);

const IconDroplet = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
    <path
      d="M12 3S6 10 6 14a6 6 0 1 0 12 0c0-4-6-11-6-11Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconExport = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
    <path
      d="M12 3v12m0 0 4-4m-4 4-4-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type HowItWorksSectionProps = {
  copy: LandingPageTranslations["howItWorks"];
};

const icons = [IconMap, IconDroplet, IconExport];

export function HowItWorksSection({ copy }: HowItWorksSectionProps) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/50 p-6 shadow-inner sm:p-10">
      <div className="space-y-4 sm:space-y-6">
        <h2 className="text-2xl font-semibold text-slate-50 sm:text-3xl">{copy.title}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {copy.steps.map((step, index) => {
            const Icon = icons[index] ?? IconMap;
            return (
              <div
                key={step.title}
                className="h-full rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm transition hover:-translate-y-[1px] hover:border-emerald-300/60"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-200">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-50">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
