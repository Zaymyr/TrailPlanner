import type { ComponentPropsWithoutRef } from "react";

const variantIconMap = {
  start: "/race-planner/icons/start.svg",
  ravito: "/race-planner/icons/ravito.svg",
} as const;

type AidStationBadgeProps = ComponentPropsWithoutRef<"div"> & {
  step: number;
  variant: keyof typeof variantIconMap;
};

export function AidStationBadge({ step, variant, className, ...props }: AidStationBadgeProps) {
  const iconSrc = variantIconMap[variant];

  return (
    <div
      className={[
        "relative inline-flex h-14 w-14 items-center justify-center sm:h-12 sm:w-12 md:h-14 md:w-14",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <img src={iconSrc} alt="" aria-hidden className="h-full w-full object-contain" />
      <span className="absolute bottom-0 left-0 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border border-slate-700 bg-slate-950/90 px-1 text-[11px] font-semibold text-white shadow">
        {step}
      </span>
    </div>
  );
}
