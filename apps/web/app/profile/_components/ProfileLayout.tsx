import type { ReactNode } from "react";

/** One block of the profile page (subscription, personal details, favorites). */
export function ProfileSection({
  id,
  title,
  subtitle,
  action,
  children,
}: {
  id: string;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 id={id} className="text-lg font-bold text-foreground">
            {title}
          </h2>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Modal frame of the profile dialogs: full-screen sheet on phones, centered panel from `sm`.
 * Escape handling and focus restoration stay in the page, which owns the open state of every dialog.
 */
export function ProfileDialog({
  titleId,
  title,
  description,
  closeLabel,
  onClose,
  role = "dialog",
  widthClassName = "sm:max-w-lg",
  children,
  footer,
}: {
  titleId: string;
  title: string;
  description?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  role?: "dialog" | "alertdialog";
  widthClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div aria-hidden className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[100dvh] w-full flex-col overflow-hidden bg-card text-foreground shadow-2xl sm:max-h-[88vh] sm:rounded-3xl sm:border sm:border-border ${widthClassName}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
          <div className="min-w-0 space-y-1">
            <h2 id={titleId} className="text-lg font-bold leading-tight text-foreground">
              {title}
            </h2>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="-mr-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">{children}</div>
        {footer ? (
          <footer className="flex flex-col-reverse gap-2 border-t border-border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-end sm:px-6 sm:pb-5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export function ProfileError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm font-medium text-pace-semantic-danger">
      {children}
    </p>
  );
}

/** 16 px text on phones (no iOS zoom), 44 px touch height. */
export const profileFieldClassName = "h-11 rounded-xl text-base sm:text-sm";
