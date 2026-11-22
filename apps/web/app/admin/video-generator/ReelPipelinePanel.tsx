"use client";

import Link from "next/link";
import React from "react";

import { Button } from "../../../components/ui/button";
import {
  REEL_PIPELINE_STEPS,
  REEL_RENDER_ETA_MINUTES,
  REEL_STEP_LABELS,
  type ReelPipelineState,
  type ReelStepStatus,
} from "./reel-pipeline";

const STATUS_MARKS: Record<ReelStepStatus, string> = { pending: "○", running: "…", done: "✓", error: "✕" };
const STATUS_LABELS: Record<ReelStepStatus, string> = { pending: "À faire", running: "En cours", done: "Terminé", error: "Échec" };

export type ReelPipelineMode = "highlights" | "full";

const MODE_LABELS: Record<ReelPipelineMode, string> = { highlights: "Temps forts", full: "Parcours complet" };
const MODE_HELP: Record<ReelPipelineMode, string> = {
  highlights: "Rédige le texte « Temps forts » (hook, moments clés, légende), génère la voix, enregistre le récit puis lance le rendu.",
  full: "Rédige la narration du parcours tronçon par tronçon puis la légende Instagram, génère la voix, enregistre le récit puis lance le rendu.",
};

type ReelPipelinePanelProps = {
  /** A race with a usable GPX is loaded and no other action is running. */
  canRun: boolean;
  /** The story mode the button generates (the editor's mode), and the one the reel rules advise for this distance. */
  mode: ReelPipelineMode;
  recommendedMode: ReelPipelineMode;
  onModeChange: (mode: ReelPipelineMode) => void;
  /** Name of the voice of the narration (« Voix : … »), when one is known. */
  voiceLabel?: string | null;
  pipeline: {
    state: ReelPipelineState;
    cancelRequested: boolean;
    running: boolean;
    start: () => void | Promise<void>;
    resume: () => void | Promise<void>;
    cancel: () => void;
  };
};

/**
 * « Générer le reel »: the whole flow of a reel in one click, Temps forts or Parcours complet. The
 * individual buttons below stay available to retouch the text, the voice or the settings afterwards.
 */
export function ReelPipelinePanel({ canRun, pipeline, voiceLabel, mode, recommendedMode, onModeChange }: ReelPipelinePanelProps) {
  const { state, running, cancelRequested } = pipeline;
  const started = state.status !== "idle";
  const renderStarted = state.steps.render === "running" || state.steps.render === "done";

  return (
    <div className="mb-4 space-y-2 rounded-md border border-brand/40 bg-brand/5 p-3 text-foreground" data-testid="reel-pipeline">
      <div className="grid grid-cols-2 gap-1 rounded-full border border-border bg-card p-1" role="radiogroup" aria-label="Type de reel">
        {(["full", "highlights"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={mode === option}
            disabled={running}
            onClick={() => onModeChange(option)}
            className={`rounded-full px-2 py-1 text-xs font-medium disabled:opacity-60 ${mode === option ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"}`}
          >
            {MODE_LABELS[option]}{option === recommendedMode ? " ★" : ""}
          </button>
        ))}
      </div>
      <Button type="button" className="h-10 w-full text-sm font-semibold" disabled={!canRun || running} onClick={() => void pipeline.start()}>
        {running ? "Génération du reel…" : state.status === "done" ? "Générer à nouveau le reel" : "Générer le reel"}
      </Button>
      {!started ? (
        <p className="text-xs text-muted-foreground">
          {MODE_HELP[mode]} Le brouillon Instagram est créé à la fin du rendu. ★ conseillé pour cette course : parcours complet jusqu’à 60 km, temps forts au-delà.
        </p>
      ) : (
        <ol aria-label="Progression du reel" className="space-y-1 text-xs">
          {REEL_PIPELINE_STEPS.map((step) => {
            const status = state.steps[step];
            return (
              <li key={step} className={`flex items-center gap-2 ${status === "error" ? "text-red-700" : status === "pending" ? "text-muted-foreground" : ""}`}>
                <span aria-hidden="true" className="w-4 text-center font-semibold">{STATUS_MARKS[status]}</span>
                <span className="font-medium">{REEL_STEP_LABELS[step]}</span>
                <span className="text-muted-foreground">{STATUS_LABELS[status]}</span>
              </li>
            );
          })}
        </ol>
      )}

      {started && voiceLabel && state.steps.voice === "done" ? (
        <p className="text-xs" data-testid="reel-voice">Voix : <span className="font-semibold">{voiceLabel}</span></p>
      ) : null}

      {state.status === "error" && state.failedStep ? (
        <div role="alert" className="space-y-1.5 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          <p>Échec à l’étape « {REEL_STEP_LABELS[state.failedStep]} » : {state.error}</p>
          <Button type="button" variant="outline" className="h-8 px-2 text-xs" disabled={!canRun || running} onClick={() => void pipeline.resume()}>
            Reprendre
          </Button>
        </div>
      ) : null}

      {state.status === "cancelled" ? (
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p>Génération annulée avant le rendu. Les étapes terminées sont conservées.</p>
          <Button type="button" variant="outline" className="h-8 px-2 text-xs" disabled={!canRun || running} onClick={() => void pipeline.resume()}>
            Reprendre
          </Button>
        </div>
      ) : null}

      {running && !renderStarted ? (
        <Button type="button" variant="ghost" className="h-8 px-2 text-xs" disabled={cancelRequested} onClick={pipeline.cancel}>
          {cancelRequested ? "Annulation après l’étape en cours…" : "Annuler"}
        </Button>
      ) : null}

      {state.status === "done" ? (
        <p role="status" className="text-xs">
          Rendu lancé — le brouillon apparaîtra dans{" "}
          <Link href="/admin/content/posts" className="font-semibold underline underline-offset-2">Publications</Link>{" "}
          à la fin du rendu (≈ {REEL_RENDER_ETA_MINUTES} min).
        </p>
      ) : null}

      {state.warnings.length ? (
        <div className="space-y-0.5 text-xs text-amber-800">
          <p className="font-semibold">À vérifier avant de publier (non bloquant)</p>
          <ul aria-label="Points à vérifier" className="list-disc space-y-0.5 pl-4">
            {state.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
