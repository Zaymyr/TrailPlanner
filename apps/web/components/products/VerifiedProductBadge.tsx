import { cn } from "../utils";

type VerifiedProductBadgeProps = {
  className?: string;
  locale?: "en" | "fr";
};

export const isVerifiedProduct = (product: { isOfficial?: boolean | null }) => product.isOfficial === true;

export function VerifiedProductBadge({ className, locale = "fr" }: VerifiedProductBadgeProps) {
  const label = locale === "fr" ? "Données validées" : "Verified data";

  return (
    <span
      aria-label={label}
      role="img"
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full drop-shadow-sm",
        className
      )}
      title={label}
    >
      <img src="/branding/verified-product.png" alt="" className="h-full w-full object-contain" />
    </span>
  );
}
