"use client";

import React from "react";

import { Button } from "../../../components/ui/button";
import { estimateNarrationMs } from "./route-story";
import type { ScheduledBeat } from "./video-composition";
import type { SavedVoice } from "./voice-library";
import { VoiceIdPicker } from "./VoiceIdPicker";

export type AsyncActionState = { status: "idle" | "loading" | "success" | "error"; message: string | null };

export type VoiceOptions = { model: "multilingual_v2" | "v3"; expressiveness: number };

const KIND_LABELS: Record<ScheduledBeat["kind"], string> = {
  intro: "Intro",
  start: "Départ",
  climb: "Montée",
  descent: "Descente",
  flat: "Roulant",
  aid: "Ravito",
  lifeBase: "Base de vie",
  finish: "Arrivée",
  outro: "Conclusion",
};

const formatTime = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

type StoryEditorProps = {
  beats: ScheduledBeat[];
  narrationOverflow: boolean;
  onGenerateVoice: () => void;
  onNarrationChange: (beatId: string, narration: string) => void;
  onResetScript: () => void;
  onVoiceIdChange: (voiceId: string) => void;
  onForgetVoice: (voiceId: string) => void;
  onSaveVoice: (voiceId: string, name: string) => void;
  onVoiceOptionsChange: (options: VoiceOptions) => void;
  onWriteScript: () => void;
  scriptState: AsyncActionState;
  totalMs: number;
  voiceId: string;
  voiceOptions: VoiceOptions;
  voiceReadyIds: Set<string>;
  voiceState: AsyncActionState;
  voices: SavedVoice[];
};

function ActionMessage({ state }: { state: AsyncActionState }) {
  if (!state.message) return null;
  return <p className={`text-xs ${state.status === "error" ? "text-red-700" : "text-muted-foreground"}`}>{state.message}</p>;
}

/** The narrated script: one editable line per moment, with its place in the video and voice status. */
export function StoryEditor({
  beats,
  narrationOverflow,
  onGenerateVoice,
  onNarrationChange,
  onResetScript,
  onVoiceIdChange,
  onForgetVoice,
  onSaveVoice,
  onVoiceOptionsChange,
  onWriteScript,
  scriptState,
  totalMs,
  voiceId,
  voiceOptions,
  voiceReadyIds,
  voiceState,
  voices,
}: StoryEditorProps) {
  const busy = scriptState.status === "loading" || voiceState.status === "loading";
  const voicedCount = beats.filter((beat) => voiceReadyIds.has(beat.id)).length;
  return (
    <div className="space-y-3 text-foreground">
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" className="h-9 px-2 text-xs" disabled={busy} onClick={onWriteScript}>
          {scriptState.status === "loading" ? "Rédaction…" : "Rédiger avec l’IA"}
        </Button>
        <Button type="button" variant="outline" className="h-9 px-2 text-xs" disabled={busy || beats.length === 0} onClick={onGenerateVoice}>
          {voiceState.status === "loading" ? "Génération…" : "Générer la voix off"}
        </Button>
      </div>
      <ActionMessage state={scriptState} />
      <ActionMessage state={voiceState} />
      <p className="text-xs text-muted-foreground">
        Vidéo de {formatTime(totalMs)} · {beats.length} moments · voix {voicedCount}/{beats.length}
      </p>
      <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2">
        <div role="group" aria-label="Modèle de voix" className="flex rounded-md border border-border bg-muted/30 p-1">
          {([["multilingual_v2", "Stable (v2)"], ["v3", "Expressive (v3)"]] as const).map(([model, label]) => (
            <Button
              key={model}
              type="button"
              aria-pressed={voiceOptions.model === model}
              className="h-7 flex-1 px-2 text-xs"
              variant={voiceOptions.model === model ? "default" : "ghost"}
              onClick={() => onVoiceOptionsChange({ ...voiceOptions, model })}
            >
              {label}
            </Button>
          ))}
        </div>
        <label className="block space-y-1 text-xs">
          <span className="flex justify-between font-medium">
            Intonation
            <span className="text-muted-foreground">{voiceOptions.expressiveness < 0.34 ? "posée" : voiceOptions.expressiveness < 0.67 ? "naturelle" : "très vivante"}</span>
          </span>
          <input
            aria-label="Expressivité de la voix"
            type="range"
            className="w-full accent-brand"
            min={0}
            max={1}
            step={0.05}
            value={voiceOptions.expressiveness}
            onChange={(event) => onVoiceOptionsChange({ ...voiceOptions, expressiveness: Number(event.target.value) })}
          />
        </label>
        <p className="text-[10px] text-muted-foreground">Change la voix ou ces réglages puis régénère la voix off.</p>
      </div>

      <div className="flex items-start gap-2">
        <VoiceIdPicker
          disabled={busy}
          onForget={onForgetVoice}
          onSave={onSaveVoice}
          onVoiceIdChange={onVoiceIdChange}
          voiceId={voiceId}
          voices={voices}
        />
        <Button type="button" variant="ghost" className="mb-auto mt-5 h-8 px-2 text-xs" disabled={busy} onClick={onResetScript}>
          Texte par défaut
        </Button>
      </div>

      {narrationOverflow ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          La narration est trop longue pour la durée choisie : raccourcis les textes ou passe la durée en automatique.
        </p>
      ) : null}

      <details className="group" open>
        <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
          Textes de narration ({beats.length})
          <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
        </summary>
        <ol className="space-y-2">
          {beats.map((beat) => {
            const voiced = voiceReadyIds.has(beat.id);
            return (
              <li key={beat.id} className="rounded-md border border-border bg-muted/20 p-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 rounded bg-brand px-1.5 py-0.5 font-semibold text-brand-foreground">{KIND_LABELS[beat.kind]}</span>
                    <span className="truncate font-medium">{beat.kind === "intro" || beat.kind === "outro" ? "" : beat.title}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 tabular-nums text-muted-foreground">
                    {formatTime(beat.narrationStartMs)}
                    <span
                      className={`h-2 w-2 rounded-full ${voiced ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                      title={voiced ? "Voix générée" : "Voix à générer"}
                    />
                  </span>
                </div>
                <textarea
                  aria-label={`Narration : ${KIND_LABELS[beat.kind]} ${beat.title}`}
                  className="mt-1.5 w-full resize-y rounded border border-input bg-card px-2 py-1 text-xs leading-snug"
                  rows={2}
                  value={beat.narration}
                  onChange={(event) => onNarrationChange(beat.id, event.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  ≈ {(estimateNarrationMs(beat.narration) / 1_000).toFixed(1)} s{beat.facts.length ? ` · ${beat.facts.join(" · ")}` : ""}
                </p>
              </li>
            );
          })}
        </ol>

      </details>
    </div>
  );
}
