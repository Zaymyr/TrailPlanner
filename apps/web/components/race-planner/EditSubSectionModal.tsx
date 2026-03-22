"use client";

import { useEffect, useState } from "react";

import type { RacePlannerTranslations } from "../../locales/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type EditSubSectionPayload = {
  segmentKm: number;
  label: string;
};

type EditSubSectionModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: EditSubSectionPayload) => void;
  title?: string;
  copy: RacePlannerTranslations["segments"];
  initialDistanceKm: number;
  initialLabel: string;
  maxDistanceKm?: number;
};

export function EditSubSectionModal({
  open,
  onClose,
  onConfirm,
  title,
  copy,
  initialDistanceKm,
  initialLabel,
  maxDistanceKm,
}: EditSubSectionModalProps) {
  const [distanceKm, setDistanceKm] = useState(String(initialDistanceKm));
  const [label, setLabel] = useState(initialLabel);

  useEffect(() => {
    if (open) {
      setDistanceKm(String(initialDistanceKm));
      setLabel(initialLabel);
    }
  }, [initialDistanceKm, initialLabel, open]);

  if (!open) return null;

  const parsedDistance = Number(distanceKm);
  const distanceValue = Number.isFinite(parsedDistance) ? parsedDistance : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border-strong bg-card p-5 shadow-2xl dark:bg-slate-950">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground dark:text-slate-50">
            {title ?? copy.editModal.title}
          </p>
          <p className="text-xs text-muted-foreground">{copy.editModal.description}</p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{copy.editModal.distanceLabel}</Label>
            <Input
              type="number"
              step="0.1"
              min="0.01"
              max={maxDistanceKm}
              value={distanceKm}
              onChange={(event) => setDistanceKm(event.target.value)}
              className="border-border bg-background text-sm text-foreground focus-visible:ring-ring dark:bg-slate-900"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{copy.editModal.labelLabel}</Label>
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={copy.editModal.labelPlaceholder}
              className="border-border bg-background text-sm text-foreground focus-visible:ring-ring dark:bg-slate-900"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {copy.editModal.cancel}
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                segmentKm: distanceValue,
                label: label.trim(),
              })
            }
          >
            {copy.editModal.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
