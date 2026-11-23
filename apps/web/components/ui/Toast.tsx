"use client";

import * as React from "react";

import { cn } from "../utils";

export type ToastTone = "neutral" | "success" | "danger";

export type ToastOptions = {
  message: string;
  tone?: ToastTone;
  /** Label of the undo-style action (« Annuler »); the action runs once, then the toast closes. */
  actionLabel?: string;
  onAction?: () => void;
  /** Auto-close delay; default 5 s, 8 s with an action. */
  durationMs?: number;
};

type ToastEntry = ToastOptions & { id: number };

type ToastContextValue = {
  show: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

const TONE_CLASSES: Record<ToastTone, string> = {
  neutral: "border-stone-700 bg-[#1f2a12] text-white",
  success: "border-emerald-700 bg-[#1f2a12] text-white",
  danger: "border-red-700 bg-red-900 text-white",
};

/** Toast stack of the admin console (bottom right, polite live region). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastEntry[]>([]);
  const nextId = React.useRef(1);
  const timers = React.useRef(new Map<number, number>());

  const dismiss = React.useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = React.useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { ...options, id }]);
      const duration = options.durationMs ?? (options.onAction ? 8_000 : 5_000);
      timers.current.set(id, window.setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const value = React.useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn("pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg", TONE_CLASSES[toast.tone ?? "neutral"])}
          >
            <p className="min-w-0 flex-1">{toast.message}</p>
            {toast.actionLabel && toast.onAction ? (
              <button
                type="button"
                className="shrink-0 rounded-md px-2 py-1 font-semibold text-[#c8d44e] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8d44e]"
                onClick={() => {
                  toast.onAction?.();
                  dismiss(toast.id);
                }}
              >
                {toast.actionLabel}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Fermer la notification"
              className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              onClick={() => dismiss(toast.id)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** `show({ message, actionLabel: "Annuler", onAction })` inside a `ToastProvider`. */
export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside a ToastProvider.");
  return context;
}
