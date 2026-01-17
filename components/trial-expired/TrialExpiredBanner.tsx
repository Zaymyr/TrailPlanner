import { Button } from "../ui/button";

type TrialExpiredBannerProps = {
  message: string;
  ctaLabel: string;
  onUpgrade: () => void;
  isLoading?: boolean;
  error?: string | null;
};

export const TrialExpiredBanner = ({
  message,
  ctaLabel,
  onUpgrade,
  isLoading = false,
  error,
}: TrialExpiredBannerProps) => {
  return (
    <div className="rounded-lg border border-amber-200/60 bg-amber-50/70 p-4 text-sm text-amber-950 shadow-sm dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>{message}</p>
        <Button type="button" onClick={onUpgrade} disabled={isLoading}>
          {ctaLabel}
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p> : null}
    </div>
  );
};
