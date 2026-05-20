import { cn } from "../utils";

type VerifiedProductBadgeProps = {
  className?: string;
  locale?: "en" | "fr";
};

export const isVerifiedProduct = (product: { createdBy?: string | null }) => product.createdBy === null;

export function VerifiedProductBadge({ className, locale = "fr" }: VerifiedProductBadgeProps) {
  const label = locale === "fr" ? "Données validées" : "Verified data";
  const shortLabel = locale === "fr" ? "Validé" : "Verified";

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-300/70 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold leading-5 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-100",
        className
      )}
      title={label}
    >
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      <span className="truncate">{shortLabel}</span>
    </span>
  );
}
