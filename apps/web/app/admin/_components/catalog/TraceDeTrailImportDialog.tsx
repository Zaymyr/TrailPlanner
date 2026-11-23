"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import type { AdminTranslations } from "../../../../locales/types";
import type { ExistingRacePreview, ImportedRacePreview, RaceRow } from "./race-catalog-model";

type CatalogT = AdminTranslations["raceCatalog"];

/**
 * Trace de Trail session typed by the admin (never stored): shared by the import dialog and by
 * « Importer » of the race edit dialog (`enrich`). `savedVersion` changes when « Enregistrer » is
 * pressed, so the import dialog drops a preview made with other credentials.
 */
export function useTraceDeTrailCredentials() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savedVersion, setSavedVersion] = useState(0);
  return {
    login,
    setLogin,
    password,
    setPassword,
    dialogOpen,
    setDialogOpen,
    savedVersion,
    markSaved: () => setSavedVersion((version) => version + 1),
    hasCredentials: login.trim().length > 0 && password.length > 0,
    /** Body field of `POST /api/admin/race-catalog/tracedetrail` (absent without both values). */
    credentials: login.trim() && password ? { login: login.trim(), password } : undefined,
    clear: () => {
      setLogin("");
      setPassword("");
    },
  };
}

export type TraceDeTrailCredentials = ReturnType<typeof useTraceDeTrailCredentials>;

/** « Se connecter à Trace de Trail »: login and password for protected GPX files. */
export function TraceDeTrailCredentialsDialog({ t, credentials }: { t: CatalogT; credentials: TraceDeTrailCredentials }) {
  return (
    <Dialog
      open={credentials.dialogOpen}
      onOpenChange={(open) => {
        credentials.setDialogOpen(open);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.traceDeTrailCredentialsTitle}</DialogTitle>
          <DialogDescription>{t.traceDeTrailCredentialsDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">{t.fields.traceDeTrailLogin}</Label>
            <Input
              className="h-9 text-sm"
              value={credentials.login}
              onChange={(event) => credentials.setLogin(event.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t.fields.traceDeTrailPassword}</Label>
            <Input
              className="h-9 text-sm"
              type="password"
              value={credentials.password}
              onChange={(event) => credentials.setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => credentials.setDialogOpen(false)}>
            {t.actions.cancel}
          </Button>
          <Button
            type="button"
            disabled={!credentials.login.trim() || !credentials.password}
            onClick={() => {
              credentials.markSaved();
              credentials.setDialogOpen(false);
            }}
          >
            {t.actions.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * « Importer depuis Trace de Trail »: preview, GPX download and import through
 * `POST /api/admin/race-catalog/tracedetrail` (`preview`, `download`, `import`), with the optional
 * session. Reset each time it opens; dismissing it also forgets the session, as before lot 5.
 */
export function TraceDeTrailImportDialog({ accessToken, t, open, credentials, onOpenChange, onImported }: {
  accessToken?: string;
  t: CatalogT;
  open: boolean;
  credentials: TraceDeTrailCredentials;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [traceDeTrailUrl, setTraceDeTrailUrl] = useState("");
  const [traceDeTrailPreview, setTraceDeTrailPreview] = useState<ImportedRacePreview | null>(null);
  const [traceDeTrailDuplicateRace, setTraceDeTrailDuplicateRace] = useState<ExistingRacePreview | null>(null);
  const [traceDeTrailError, setTraceDeTrailError] = useState<string | null>(null);

  const resetLocal = () => {
    setTraceDeTrailUrl("");
    setTraceDeTrailPreview(null);
    setTraceDeTrailDuplicateRace(null);
    setTraceDeTrailError(null);
  };
  const resetTraceDeTrailDialog = () => {
    resetLocal();
    credentials.setDialogOpen(false);
    credentials.clear();
  };

  useEffect(() => {
    if (open) resetTraceDeTrailDialog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // « Enregistrer » in the session dialog: a new session invalidates the current preview.
  useEffect(() => {
    if (credentials.savedVersion === 0) return;
    setTraceDeTrailPreview(null);
    setTraceDeTrailDuplicateRace(null);
    setTraceDeTrailError(null);
  }, [credentials.savedVersion]);

  const post = (body: Record<string, unknown>) => fetch("/api/admin/race-catalog/tracedetrail", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ ...body, credentials: credentials.credentials }),
  });

  const traceDeTrailPreviewMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await post({ url, action: "preview" });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; preview?: ImportedRacePreview; duplicateRace?: ExistingRacePreview | null }
        | null;

      if (!response.ok || !data?.preview) {
        throw new Error(data?.message ?? t.errors.traceDeTrailImportFailed);
      }

      return data;
    },
    onSuccess: (data) => {
      setTraceDeTrailPreview(data.preview ?? null);
      setTraceDeTrailDuplicateRace(data.duplicateRace ?? null);
      setTraceDeTrailError(null);
    },
    onError: (err) => {
      setTraceDeTrailPreview(null);
      setTraceDeTrailDuplicateRace(null);
      setTraceDeTrailError(err instanceof Error ? err.message : t.errors.traceDeTrailImportFailed);
    },
  });

  const traceDeTrailImportMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await post({ url, action: "import" });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; race?: RaceRow }
        | null;

      if (!response.ok || !data?.race) {
        throw new Error(data?.message ?? t.errors.traceDeTrailImportFailed);
      }

      return data;
    },
    onSuccess: () => {
      resetTraceDeTrailDialog();
      onOpenChange(false);
      onImported();
    },
    onError: (err) => {
      setTraceDeTrailError(err instanceof Error ? err.message : t.errors.traceDeTrailImportFailed);
    },
  });

  const traceDeTrailDownloadMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await post({ url, action: "download" });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? t.errors.traceDeTrailImportFailed);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition");
      const filename = disposition?.match(/filename="([^"]+)"/i)?.[1] ?? "trace-de-trail.gpx";
      return { blob, filename };
    },
    onSuccess: ({ blob, filename }) => {
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setTraceDeTrailError(null);
    },
    onError: (err) => {
      setTraceDeTrailError(err instanceof Error ? err.message : t.errors.traceDeTrailImportFailed);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetTraceDeTrailDialog();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.traceDeTrailTitle}</DialogTitle>
          <DialogDescription>{t.traceDeTrailDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">{t.fields.traceDeTrailUrl}</Label>
            <Input
              className="h-9 text-sm"
              placeholder="https://tracedetrail.fr/fr/trace/312934"
              value={traceDeTrailUrl}
              onChange={(event) => {
                setTraceDeTrailUrl(event.target.value);
                setTraceDeTrailPreview(null);
                setTraceDeTrailDuplicateRace(null);
                setTraceDeTrailError(null);
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => credentials.setDialogOpen(true)}>
              {t.actions.connectTraceDeTrail}
            </Button>
            {credentials.hasCredentials ? (
              <>
                <span className="text-xs text-emerald-700 dark:text-emerald-300">
                  {t.traceDeTrailCredentialsSaved}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2 text-xs"
                  onClick={() => {
                    credentials.clear();
                    setTraceDeTrailPreview(null);
                    setTraceDeTrailError(null);
                  }}
                >
                  {t.actions.clearTraceDeTrailCredentials}
                </Button>
              </>
            ) : null}
          </div>

          {traceDeTrailError ? (
            <p className="text-sm text-red-600 dark:text-red-300">{traceDeTrailError}</p>
          ) : null}

          {traceDeTrailPreview ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {t.traceDeTrailPreview.title}
              </p>
              <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <p className="font-medium">{traceDeTrailPreview.courseName}</p>
                <p>{traceDeTrailPreview.eventName}</p>
                <p>
                  {traceDeTrailPreview.distanceKm.toFixed(1)} km · D+{" "}
                  {Math.round(traceDeTrailPreview.elevationGainM)} m · D-{" "}
                  {Math.round(traceDeTrailPreview.elevationLossM)} m
                </p>
                <p>
                  {traceDeTrailPreview.location ?? "—"}
                  {traceDeTrailPreview.date ? ` · ${traceDeTrailPreview.date}` : ""}
                </p>
                <p>
                  {t.traceDeTrailPreview.aidStations.replace(
                    "{count}",
                    String(traceDeTrailPreview.aidStationCount)
                  )}
                </p>
                {traceDeTrailPreview.gpxAccessMode === "embedded" ? (
                  <p className="text-amber-700 dark:text-amber-200">{t.traceDeTrailProtectedNotice}</p>
                ) : null}
                {traceDeTrailPreview.gpxAccessMode === "authenticated" ? (
                  <p className="text-emerald-700 dark:text-emerald-300">{t.traceDeTrailAuthenticatedNotice}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {traceDeTrailDuplicateRace ? (
            <p className="text-sm text-amber-700 dark:text-amber-200">
              {t.errors.traceDeTrailDuplicate.replace("{name}", traceDeTrailDuplicateRace.name)}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.actions.cancel}
            </Button>
            {!traceDeTrailPreview ? (
              <Button
                type="button"
                disabled={!traceDeTrailUrl.trim() || traceDeTrailPreviewMutation.isPending}
                onClick={() => traceDeTrailPreviewMutation.mutate(traceDeTrailUrl.trim())}
              >
                {traceDeTrailPreviewMutation.isPending ? t.actions.loadingImport : t.actions.import}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={traceDeTrailDownloadMutation.isPending || traceDeTrailImportMutation.isPending}
                  onClick={() => traceDeTrailDownloadMutation.mutate(traceDeTrailUrl.trim())}
                >
                  {traceDeTrailDownloadMutation.isPending ? t.actions.downloadingGpx : t.actions.downloadGpx}
                </Button>
                <Button
                  type="button"
                  disabled={
                    Boolean(traceDeTrailDuplicateRace) ||
                    traceDeTrailImportMutation.isPending ||
                    traceDeTrailDownloadMutation.isPending
                  }
                  onClick={() => traceDeTrailImportMutation.mutate(traceDeTrailUrl.trim())}
                >
                  {traceDeTrailImportMutation.isPending ? t.actions.importing : t.actions.confirmImport}
                </Button>
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
