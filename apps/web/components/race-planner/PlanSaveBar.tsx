"use client";

import { Button } from "../ui/button";

type PlanSaveBarProps = {
  isVisible: boolean;
  isSaving: boolean;
  isDisabled: boolean;
  unsavedLabel: string;
  saveLabel: string;
  contextLabel: string;
  errorMessage?: string | null;
  onSave: () => void;
};

export function PlanSaveBar({
  isVisible,
  isSaving,
  isDisabled,
  unsavedLabel,
  saveLabel,
  contextLabel,
  errorMessage,
  onSave,
}: PlanSaveBarProps) {
  if (!isVisible) return null;

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-amber-300/40 bg-card/95 p-3 shadow-2xl backdrop-blur dark:border-amber-500/40 dark:bg-slate-950/90 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{unsavedLabel}</p>
        <p className="truncate text-xs text-muted-foreground dark:text-slate-300">{contextLabel}</p>
        {errorMessage ? <p className="text-xs text-red-500 dark:text-red-300">{errorMessage}</p> : null}
      </div>
      <Button
        type="button"
        onClick={onSave}
        disabled={isSaving || isDisabled}
        className="w-full sm:w-auto"
      >
        {isSaving ? `${saveLabel}…` : saveLabel}
      </Button>
    </div>
  );
}
