import Image from "next/image";
import type { ComponentPropsWithoutRef } from "react";

const variantIconMap = {
  start: "/race-planner/icons/start.svg",
  ravito: "/race-planner/icons/ravito.svg",
} as const;

const variantBadgePositionMap = {
  start: "bottom-2 left-1/2 -translate-x-1/2",
  ravito: "bottom-1 left-[39%] -translate-x-1/2",
} as const;

type AidStationBadgeProps = ComponentPropsWithoutRef<"div"> & {
  step: number;
  variant: keyof typeof variantIconMap;
};

export function AidStationBadge({ step, variant, className, ...props }: AidStationBadgeProps) {
  const iconSrc = variantIconMap[variant];
  const badgePosition = variantBadgePositionMap[variant];

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
      <Image
        src={iconSrc}
        alt=""
        aria-hidden
        width={56}
        height={56}
        className="h-full w-full object-contain invert dark:invert-0"
      />
      <span className={`absolute ${badgePosition} flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border border-border bg-card px-1 text-[11px] font-semibold text-foreground shadow dark:border-slate-700 dark:bg-slate-950/90 dark:text-white`}>
        {step}
      </span>
    </div>
  );
}
