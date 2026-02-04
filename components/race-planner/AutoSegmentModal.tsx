"use client";

import { useEffect, useMemo, useState } from "react";

import type { RacePlannerTranslations } from "../../locales/types";
import { Button } from "../ui/button";

type AutoSegmentModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (granularityKm: number) => void;
  title?: string;
  copy: RacePlannerTranslations["segments"];
};

export function AutoSegmentModal({ open, onClose, onConfirm, title, copy }: AutoSegmentModalProps) {
  const granularityOptions = useMemo(
    () => [
      { value: 1, label: copy.granularity.coarse },
      { value: 0.5, label: copy.granularity.medium },
      { value: 0.25, label: copy.granularity.fine },
    ],
    [copy.granularity.coarse, copy.granularity.fine, copy.granularity.medium]
  );
  const [granularityKm, setGranularityKm] = useState(granularityOptions[1]?.value ?? 0.5);

  useEffect(() => {
    if (open) {
      setGranularityKm(granularityOptions[1]?.value ?? 0.5);
    }
  }, [granularityOptions, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border-strong bg-card p-5 shadow-2xl dark:bg-slate-950">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground dark:text-slate-50">
            {title ?? "Découpage automatique"}
          </p>
          <p className="text-xs text-muted-foreground">
            Choisissez une granularité pour générer des segments réguliers.
          </p>
        </div>
        <div className="space-y-2">
          {granularityOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm dark:bg-slate-900/70"
            >
              <span>{option.label}</span>
              <input
                type="radio"
                name="auto-segment-granularity"
                value={option.value}
                checked={granularityKm === option.value}
                onChange={() => setGranularityKm(option.value)}
                className="h-4 w-4 text-emerald-500"
              />
            </label>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => onConfirm(granularityKm)}>Confirmer</Button>
        </div>
      </div>
    </div>
  );
}
