"use client";

import React from "react";

import { Button } from "../../../components/ui/button";
import type { ExportProgress, SoundtrackReport } from "./video-export";

export type ExportState =
  | { status: "idle"; message?: string }
  | { status: "running"; progress?: ExportProgress }
  | { status: "done"; url: string; sizeBytes: number; fileName: string }
  | { status: "error"; message: string };

const formatDuration = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1_000));
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")}`;
};

const formatLufs = (value: number) => (Number.isFinite(value) ? `${value.toFixed(1).replace(".", ",")} LUFS` : "silence");
const formatDbtp = (value: number) => (Number.isFinite(value) ? `${value.toFixed(1).replace(".", ",")} dBTP` : "—");

/** What the mix measured before and after the -14 LUFS / -1 dBTP master, and the music used. */
export function SoundtrackSummary({ report }: { report: SoundtrackReport }) {
  const { master } = report;
  return (
    <div className="space-y-1 rounded-md border border-border bg-muted/40 p-2 text-xs" data-testid="soundtrack-report">
      <p className="font-medium">Son du mix</p>
      <p className="text-muted-foreground">Avant : {formatLufs(master.before.lufs)} · crête {formatDbtp(master.before.truePeakDbtp)}</p>
      <p className="text-muted-foreground">Après : {formatLufs(master.after.lufs)} · crête {formatDbtp(master.after.truePeakDbtp)}</p>
      <p className="text-muted-foreground">
        {report.music ? `Musique : ${report.music.title || report.music.id}` : report.musicFailed ? "Musique indisponible : export sans musique" : "Aucune musique"}
      </p>
      {master.limitedByPeak ? (
        <p className="text-amber-800">
          Le plafond de crête ({master.ceilingDbtp} dBTP) a limité le volume : le mix reste sous {master.targetLufs} LUFS.
        </p>
      ) : null}
    </div>
  );
}

type ExportPanelProps = {
  soundtrack?: SoundtrackReport | null;
  canExport: boolean;
  hasVoice: boolean;
  onCancel: () => void;
  onExport: () => void;
  resolutionLabel: string;
  state: ExportState;
};

/** MP4 export: start, follow the frame-by-frame progress, cancel, then download. */
export function ExportPanel({ canExport, hasVoice, onCancel, onExport, resolutionLabel, soundtrack = null, state }: ExportPanelProps) {
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
      {soundtrack && state.status !== "idle" ? <SoundtrackSummary report={soundtrack} /> : null}
      {state.status === "error" ? <p className="text-xs text-red-700">{state.message}</p> : null}
      {state.status === "idle" && state.message ? <p className="text-xs text-muted-foreground">{state.message}</p> : null}
    </div>
  );
}
