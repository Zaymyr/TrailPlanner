import { Button } from "../ui/button";

type TrialExpiredBannerProps = {
  message: string;
  ctaLabel: string;
  loadingLabel?: string;
  onUpgrade: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
  error?: string | null;
};

export const TrialExpiredBanner = ({
  message,
  ctaLabel,
  loadingLabel,
  onUpgrade,
  onDismiss,
  isLoading = false,
  error,
}: TrialExpiredBannerProps) => {
  const buttonLabel = isLoading ? loadingLabel ?? ctaLabel : ctaLabel;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-3xl rounded-lg border border-amber-200/80 bg-amber-50 p-2 text-sm text-amber-950 shadow-xl dark:border-amber-400/30 dark:bg-slate-950 dark:text-amber-100 sm:p-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <p className="min-w-0 flex-1 truncate sm:whitespace-normal">{message}</p>
        <Button type="button" className="h-11 shrink-0 px-3" onClick={onUpgrade} disabled={isLoading}>
          {buttonLabel}
        </Button>
        <button
          type="button"
          aria-label="Masquer ce message"
          onClick={onDismiss}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-xl hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:hover:bg-amber-500/10"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p> : null}
    </div>
  );
};
