"use client";

import * as React from "react";

import { cn } from "../utils";

type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "role" | "aria-checked"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label; without it, pass `aria-label` or `aria-labelledby`. */
  label?: React.ReactNode;
  description?: React.ReactNode;
};

/** Accessible on/off switch (`role="switch"`, Space/Enter toggle through the native button). */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, label, description, disabled, className, id, ...props }, ref) => {
    const generatedId = React.useId();
    const switchId = id ?? generatedId;
    const labelId = label ? `${switchId}-label` : undefined;
    const descriptionId = description ? `${switchId}-description` : undefined;
    const control = (
      <button
        ref={ref}
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-brand dark:bg-emerald-500" : "bg-stone-300 dark:bg-slate-700",
          !label && className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")}
        />
      </button>
    );
    if (!label) return control;
    return (
      <div className={cn("flex items-start justify-between gap-3", className)}>
        <div className="min-w-0">
          <label id={labelId} htmlFor={switchId} className="text-sm font-medium text-foreground">
            {label}
          </label>
          {description ? (
            <p id={descriptionId} className="text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {control}
      </div>
    );
  },
);

Switch.displayName = "Switch";
