"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import type { AdminTranslations } from "../../../../locales/types";
import type { ExistingRacePreview, ImportedRacePreview, RaceRow } from "./race-catalog-model";

/**
 * « Importer depuis UTMB »: preview (`POST /api/admin/race-catalog/utmb` `preview`), duplicate check,
 * then import (`import`). Reset each time it opens and when it is dismissed, as before lot 5.
 */
export function UtmbImportDialog({ accessToken, t, open, onOpenChange, onImported }: {
  accessToken?: string;
  t: AdminTranslations["raceCatalog"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [utmbUrl, setUtmbUrl] = useState("");
  const [utmbPreview, setUtmbPreview] = useState<ImportedRacePreview | null>(null);
  const [utmbDuplicateRace, setUtmbDuplicateRace] = useState<ExistingRacePreview | null>(null);
  const [utmbError, setUtmbError] = useState<string | null>(null);

  const resetUtmbDialog = () => {
    setUtmbUrl("");
    setUtmbPreview(null);
    setUtmbDuplicateRace(null);
    setUtmbError(null);
  };

  useEffect(() => {
    if (open) resetUtmbDialog();
  }, [open]);

  const utmbPreviewMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch("/api/admin/race-catalog/utmb", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ url, action: "preview" }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; preview?: ImportedRacePreview; duplicateRace?: ExistingRacePreview | null }
        | null;

      if (!response.ok || !data?.preview) {
        throw new Error(data?.message ?? t.errors.utmbImportFailed);
      }

      return data;
    },
    onSuccess: (data) => {
      setUtmbPreview(data.preview ?? null);
      setUtmbDuplicateRace(data.duplicateRace ?? null);
      setUtmbError(null);
    },
    onError: (err) => {
      setUtmbPreview(null);
      setUtmbDuplicateRace(null);
      setUtmbError(err instanceof Error ? err.message : t.errors.utmbImportFailed);
    },
  });

  const utmbImportMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch("/api/admin/race-catalog/utmb", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ url, action: "import" }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; race?: RaceRow }
        | null;

      if (!response.ok || !data?.race) {
        throw new Error(data?.message ?? t.errors.utmbImportFailed);
      }

      return data;
    },
    onSuccess: () => {
      resetUtmbDialog();
      onOpenChange(false);
      onImported();
    },
    onError: (err) => {
      setUtmbError(err instanceof Error ? err.message : t.errors.utmbImportFailed);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetUtmbDialog();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.utmbTitle}</DialogTitle>
          <DialogDescription>{t.utmbDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">{t.fields.utmbUrl}</Label>
            <Input
              className="h-9 text-sm"
              placeholder="https://saint-jacques.utmb.world/races/100K"
              value={utmbUrl}
              onChange={(event) => {
                setUtmbUrl(event.target.value);
                setUtmbPreview(null);
                setUtmbDuplicateRace(null);
                setUtmbError(null);
              }}
            />
          </div>

          {utmbError ? <p className="text-sm text-red-600 dark:text-red-300">{utmbError}</p> : null}

          {utmbPreview ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{t.utmbPreview.title}</p>
              <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <p className="font-medium">{utmbPreview.courseName}</p>
                <p>{utmbPreview.eventName}</p>
                <p>
                  {utmbPreview.distanceKm.toFixed(1)} km · D+ {Math.round(utmbPreview.elevationGainM)} m · D-{" "}
                  {Math.round(utmbPreview.elevationLossM)} m
                </p>
                <p>
                  {utmbPreview.location ?? "—"}
                  {utmbPreview.date ? ` · ${utmbPreview.date}` : ""}
                </p>
                <p>{t.utmbPreview.aidStations.replace("{count}", String(utmbPreview.aidStationCount))}</p>
              </div>
            </div>
          ) : null}

          {utmbDuplicateRace ? (
            <p className="text-sm text-amber-700 dark:text-amber-200">
              {t.errors.utmbDuplicate.replace("{name}", utmbDuplicateRace.name)}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.actions.cancel}
            </Button>
            {!utmbPreview ? (
              <Button
                type="button"
                disabled={!utmbUrl.trim() || utmbPreviewMutation.isPending}
                onClick={() => utmbPreviewMutation.mutate(utmbUrl.trim())}
              >
                {utmbPreviewMutation.isPending ? t.actions.loadingImport : t.actions.import}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={Boolean(utmbDuplicateRace) || utmbImportMutation.isPending}
                onClick={() => utmbImportMutation.mutate(utmbUrl.trim())}
              >
                {utmbImportMutation.isPending ? t.actions.importing : t.actions.confirmImport}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
