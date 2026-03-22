import { Button } from "../ui/button";

type TrialExpiredModalProps = {
  open: boolean;
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel: string;
  onClose: () => void;
  onUpgrade: () => void;
  isSubmitting?: boolean;
  error?: string | null;
};

export const TrialExpiredModal = ({
  open,
  title,
  description,
  primaryLabel,
  secondaryLabel,
  onClose,
  onUpgrade,
  isSubmitting = false,
  error,
}: TrialExpiredModalProps) => {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-10 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg space-y-4 rounded-lg border border-emerald-300/30 bg-card p-6 text-foreground shadow-2xl dark:bg-slate-950"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground transition hover:text-foreground"
          aria-label="Fermer"
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </button>
        <div className="space-y-3">
          <p className="text-lg font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            {secondaryLabel}
          </Button>
          <Button type="button" onClick={onUpgrade} disabled={isSubmitting}>
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
