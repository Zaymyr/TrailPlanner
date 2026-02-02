"use client";

import { useEffect, useMemo, useState } from "react";

import type { RacePlannerTranslations } from "../../locales/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type AddMarkerPayload = {
  distanceKm: number;
  type: string;
  label: string;
};

type AddMarkerModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: AddMarkerPayload) => void;
  title?: string;
  copy: RacePlannerTranslations["segments"];
};

export function AddMarkerModal({ open, onClose, onConfirm, title, copy }: AddMarkerModalProps) {
  const markerTypes = useMemo(
    () => [
      { value: "climb", label: copy.markerTypes.climb },
      { value: "descent", label: copy.markerTypes.descent },
      { value: "flat", label: copy.markerTypes.flat },
      { value: "custom", label: copy.markerTypes.custom },
    ],
    [copy.markerTypes]
  );
  const [distanceKm, setDistanceKm] = useState("0");
  const [markerType, setMarkerType] = useState(markerTypes[0]?.value ?? "climb");
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (open) {
      setDistanceKm("0");
      setMarkerType(markerTypes[0]?.value ?? "climb");
      setLabel("");
    }
  }, [markerTypes, open]);

  if (!open) return null;

  const parsedDistance = Number(distanceKm);
  const distanceValue = Number.isFinite(parsedDistance) ? parsedDistance : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border-strong bg-card p-5 shadow-2xl dark:bg-slate-950">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground dark:text-slate-50">{title ?? "Ajouter un marqueur"}</p>
          <p className="text-xs text-muted-foreground">
            Définissez un point de coupe manuel pour affiner le segment.
          </p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Point de coupe (km)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={distanceKm}
              onChange={(event) => setDistanceKm(event.target.value)}
              className="border-border bg-background text-sm text-foreground focus-visible:ring-ring dark:bg-slate-900"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Type</Label>
            <select
              value={markerType}
              onChange={(event) => setMarkerType(event.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring dark:bg-slate-900"
            >
              {markerTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Label</Label>
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ex: montée exposée"
              className="border-border bg-background text-sm text-foreground focus-visible:ring-ring dark:bg-slate-900"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                distanceKm: distanceValue,
                type: markerType,
                label: label.trim(),
              })
            }
          >
            Ajouter
          </Button>
        </div>
      </div>
    </div>
  );
}
