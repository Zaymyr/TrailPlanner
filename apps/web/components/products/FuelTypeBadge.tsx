import type { SVGProps } from "react";

import type { Locale } from "../../locales/types";
import type { FuelType } from "../../lib/fuel-types";

type IconProps = SVGProps<SVGSVGElement>;

const iconBaseProps: IconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const GelIcon = (props: IconProps) => (
  <svg {...iconBaseProps} {...props}>
    <path d="M12 2C8 7 6 10 6 13a6 6 0 0 0 12 0c0-3-2-6-6-11Z" />
  </svg>
);

const DrinkMixIcon = (props: IconProps) => (
  <svg {...iconBaseProps} {...props}>
    <path d="M9 2h6" />
    <path d="M10 2v4.5L6.5 13a4 4 0 0 0 3.4 6h4.2a4 4 0 0 0 3.4-6l-3.5-6.5V2" />
    <path d="M9.5 12h5" />
  </svg>
);

const ElectrolyteIcon = (props: IconProps) => (
  <svg {...iconBaseProps} {...props}>
    <path d="M13 2 5 13h6l-1 9 8-11h-6l1-9Z" />
  </svg>
);

const CapsuleIcon = (props: IconProps) => (
  <svg {...iconBaseProps} {...props}>
    <path d="M7.5 6.5a4.5 4.5 0 0 1 6.4 0l3.1 3.1a4.5 4.5 0 0 1-6.4 6.4l-3.1-3.1a4.5 4.5 0 0 1 0-6.4Z" />
    <path d="m8.5 8.5 7 7" />
  </svg>
);

const BarIcon = (props: IconProps) => (
  <svg {...iconBaseProps} {...props}>
    <rect x="4" y="7" width="16" height="10" rx="2" />
    <path d="M8 7v10M12 7v10M16 7v10" />
  </svg>
);

const RealFoodIcon = (props: IconProps) => (
  <svg {...iconBaseProps} {...props}>
    <path d="M12 7c-4 0-7 3-7 7 0 4 3 7 7 7s7-3 7-7c0-4-3-7-7-7Z" />
    <path d="M12 7c0-2 1-3 3-4" />
    <path d="M9 4c1.5 0 3 .6 4 1.8" />
  </svg>
);

const OtherIcon = (props: IconProps) => (
  <svg {...iconBaseProps} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h8" />
  </svg>
);

export const fuelTypeMeta: Record<
  FuelType,
  { label: { en: string; fr: string }; Icon: (props: IconProps) => JSX.Element; className: string }
> = {
  gel: {
    label: { en: "Gel", fr: "Gel" },
    Icon: GelIcon,
    className: "bg-amber-100/70 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
  },
  drink_mix: {
    label: { en: "Drink mix", fr: "Boisson" },
    Icon: DrinkMixIcon,
    className: "bg-sky-100/70 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200",
  },
  electrolyte: {
    label: { en: "Electrolyte", fr: "Électrolyte" },
    Icon: ElectrolyteIcon,
    className: "bg-blue-100/70 text-blue-800 dark:bg-blue-400/15 dark:text-blue-200",
  },
  capsule: {
    label: { en: "Capsule", fr: "Capsule" },
    Icon: CapsuleIcon,
    className: "bg-violet-100/70 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200",
  },
  bar: {
    label: { en: "Bar", fr: "Barre" },
    Icon: BarIcon,
    className: "bg-orange-100/70 text-orange-800 dark:bg-orange-400/15 dark:text-orange-200",
  },
  real_food: {
    label: { en: "Real food", fr: "Aliment" },
    Icon: RealFoodIcon,
    className: "bg-emerald-100/70 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
  },
  other: {
    label: { en: "Other", fr: "Autre" },
    Icon: OtherIcon,
    className: "bg-slate-100/70 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
  },
};

const baseBadgeClass =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-black/5 dark:ring-white/10";

export const getFuelTypeLabel = (fuelType: FuelType, locale: Locale) => {
  const meta = fuelTypeMeta[fuelType];
  return meta?.label[locale] ?? meta?.label.en ?? fuelType;
};

type FuelTypeBadgeProps = {
  fuelType: FuelType;
  locale: Locale;
  className?: string;
};

export function FuelTypeBadge({ fuelType, locale, className }: FuelTypeBadgeProps) {
  const meta = fuelTypeMeta[fuelType];
  if (!meta) return null;
  const label = getFuelTypeLabel(fuelType, locale);
  const Icon = meta.Icon;

  return (
    <span className={`${baseBadgeClass} ${meta.className}${className ? ` ${className}` : ""}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </span>
  );
}
