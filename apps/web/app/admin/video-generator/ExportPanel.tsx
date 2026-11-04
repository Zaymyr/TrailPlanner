"use client";

import React from "react";

import { Button } from "../../../components/ui/button";
import type { ExportProgress } from "./video-export";

export type ExportState =
  | { status: "idle"; message?: string }
  | { status: "running"; progress?: ExportProgress }
  | { status: "done"; url: string; sizeBytes: number; fileName: string }
  | { status: "error"; message: string };

const formatDuration = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1_000));
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")}`;
};

type ExportPanelProps = {
  canExport: boolean;
  hasVoice: boolean;
  onCancel: () => void;
  onExport: () => void;
  resolutionLabel: string;
  state: ExportState;
};

/** MP4 export: start, follow the frame-by-frame progress, cancel, then download. */
export function ExportPanel({ canExport, hasVoice, onCancel, onExport, resolutionLabel, state }: ExportPanelProps) {
  const progress = state.status === "running" ? state.progress : undefined;
  const ratio = progress ? progress.frame / progress.totalFrames : 0;
  const remainingMs = progress && progress.frame > 0
    ? (progress.elapsedMs / progress.frame) * (progress.totalFrames - progress.frame)
    : null;

  return (
    <div className="space-y-3 text-foreground">
      {state.status === "running" ? (
        <>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
            <div className="h-full bg-brand transition-[width]" style={{ width: `${ratio * 100}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {!progress || progress.phase === "preparing"
              ? "Préparation de la carte…"
              : progress.phase === "finalizing"
                ? "Finalisation du fichier MP4…"
                : `Image ${progress.frame} / ${progress.totalFrames}${remainingMs !== null ? ` · encore ≈ ${formatDuration(remainingMs)}` : ""}`}
          </p>
          <p className="text-xs text-amber-800">Garde cet onglet ouvert et visible : la carte ne se dessine pas en arrière-plan.</p>
          <Button type="button" variant="outline" className="h-8 w-full px-2 text-xs" onClick={onCancel}>Annuler l’export</Button>
        </>
      ) : (
        <>
          <Button type="button" className="h-9 w-full px-2 text-xs" disabled={!canExport} onClick={onExport}>
            Exporter la vidéo MP4 ({resolutionLabel})
          </Button>
          <p className="text-xs text-muted-foreground">
            Rendu image par image, sans saccade, avec {hasVoice ? "la voix off" : "aucune voix off (génère-la d’abord pour l’inclure)"}.
          </p>
        </>
      )}
      {state.status === "done" ? (
        <a
          className="flex h-9 w-full items-center justify-center rounded-md border border-brand bg-brand-surface px-2 text-xs font-semibold text-foreground hover:bg-brand/10"
          href={state.url}
          download={state.fileName}
        >
          Télécharger {state.fileName} ({(state.sizeBytes / 1_048_576).toFixed(1)} Mo)
        </a>
      ) : null}
      {state.status === "error" ? <p className="text-xs text-red-700">{state.message}</p> : null}
      {state.status === "idle" && state.message ? <p className="text-xs text-muted-foreground">{state.message}</p> : null}
    </div>
  );
}
