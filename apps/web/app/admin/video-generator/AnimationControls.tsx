"use client";

import React, { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import type { AnimationPlaybackSnapshot } from "./animation-controller";
import type { AnimationViewport, RouteRevealMode } from "./route-animation";

const DURATION_PRESETS = [30, 45, 60, 90] as const;
const MIN_CUSTOM_DURATION_SECONDS = 10;
const MAX_CUSTOM_DURATION_SECONDS = 300;

const formatTime = (timeMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

type AnimationControlsProps = {
  canAnimate: boolean;
  durationSeconds: number;
  isReady: boolean;
  onDurationChange: (durationSeconds: number) => void;
  onPause: () => void;
  onPlay: () => void;
  onRestart: () => void;
  onRevealModeChange: (mode: RouteRevealMode) => void;
  onSeek: (progress: number) => void;
  onViewportChange: (viewport: AnimationViewport) => void;
  revealMode: RouteRevealMode;
  snapshot: AnimationPlaybackSnapshot;
  totalDistanceKm: number;
  viewport: AnimationViewport;
};

export function AnimationControls({
  canAnimate,
  durationSeconds,
  isReady,
  onDurationChange,
  onPause,
  onPlay,
  onRestart,
  onRevealModeChange,
  onSeek,
  onViewportChange,
  revealMode,
  snapshot,
  totalDistanceKm,
  viewport,
}: AnimationControlsProps) {
  const initialPreset = DURATION_PRESETS.includes(durationSeconds as typeof DURATION_PRESETS[number])
    ? String(durationSeconds)
    : "custom";
  const [durationChoice, setDurationChoice] = useState(initialPreset);
  const [customDuration, setCustomDuration] = useState(String(durationSeconds));

  useEffect(() => {
    if (durationChoice === "custom") setCustomDuration(String(durationSeconds));
  }, [durationChoice, durationSeconds]);

  const commitCustomDuration = () => {
    const parsed = Number(customDuration);
    const nextDuration = Number.isFinite(parsed)
      ? Math.min(MAX_CUSTOM_DURATION_SECONDS, Math.max(MIN_CUSTOM_DURATION_SECONDS, Math.round(parsed)))
      : 45;
    setCustomDuration(String(nextDuration));
    onDurationChange(nextDuration);
  };

  const controlsDisabled = !canAnimate || !isReady;
  const distanceKm = totalDistanceKm * snapshot.progress;

  return (
    <section className="mt-5 w-full rounded-lg border border-border bg-card p-4 text-foreground" aria-labelledby="route-animation-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="route-animation-title" className="font-semibold">Animation du parcours</h2>
          <p className="text-xs text-muted-foreground">Mode caméra : Suivi dynamique</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={controlsDisabled}
            onClick={snapshot.isPlaying ? onPause : onPlay}
          >
            {snapshot.isPlaying ? "Pause" : "Lecture"}
          </Button>
          <Button type="button" variant="outline" disabled={controlsDisabled} onClick={onRestart}>
            Recommencer
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Durée</span>
          <select
            aria-label="Durée de l’animation"
            className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
            value={durationChoice}
            onChange={(event) => {
              const value = event.target.value;
              setDurationChoice(value);
              if (value !== "custom") onDurationChange(Number(value));
            }}
          >
            {DURATION_PRESETS.map((duration) => (
              <option key={duration} value={duration}>{duration} secondes</option>
            ))}
            <option value="custom">Personnalisée</option>
          </select>
        </label>

        {durationChoice === "custom" ? (
          <label className="space-y-1 text-sm">
            <span className="font-medium">Secondes personnalisées</span>
            <Input
              aria-label="Durée personnalisée en secondes"
              type="number"
              min={MIN_CUSTOM_DURATION_SECONDS}
              max={MAX_CUSTOM_DURATION_SECONDS}
              step={1}
              value={customDuration}
              onChange={(event) => {
                setCustomDuration(event.target.value);
                const parsed = Number(event.target.value);
                if (Number.isInteger(parsed) && parsed >= MIN_CUSTOM_DURATION_SECONDS && parsed <= MAX_CUSTOM_DURATION_SECONDS) {
                  onDurationChange(parsed);
                }
              }}
              onBlur={commitCustomDuration}
            />
          </label>
        ) : (
          <div className="space-y-1 text-sm">
            <span className="font-medium">Durée totale</span>
            <p className="flex min-h-11 items-center rounded-md border border-border bg-muted/30 px-3 tabular-nums">
              {durationSeconds} secondes
            </p>
          </div>
        )}

        <label className="space-y-1 text-sm">
          <span className="font-medium">Tracé</span>
          <select
            aria-label="Affichage du tracé"
            className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
            value={revealMode}
            onChange={(event) => onRevealModeChange(event.target.value as RouteRevealMode)}
          >
            <option value="progressive">Progressif</option>
            <option value="full">Complet</option>
          </select>
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Format de prévisualisation</legend>
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            aria-pressed={viewport === "portrait"}
            variant={viewport === "portrait" ? "default" : "outline"}
            onClick={() => onViewportChange("portrait")}
          >
            Instagram 9:16
          </Button>
          <Button
            type="button"
            aria-pressed={viewport === "landscape"}
            variant={viewport === "landscape" ? "default" : "outline"}
            onClick={() => onViewportChange("landscape")}
          >
            Classique 16:9
          </Button>
        </div>
      </fieldset>

      <div className="mt-5">
        <input
          aria-label="Progression de l’animation"
          className="h-2 w-full cursor-pointer accent-brand disabled:cursor-not-allowed"
          type="range"
          min={0}
          max={1_000}
          step={1}
          disabled={controlsDisabled}
          value={Math.round(snapshot.progress * 1_000)}
          onChange={(event) => onSeek(Number(event.target.value) / 1_000)}
        />
        <div className="mt-2 flex items-center justify-between gap-3 text-sm tabular-nums">
          <span>{formatTime(snapshot.currentTimeMs)} / {formatTime(snapshot.durationMs)}</span>
          <span>{distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km</span>
        </div>
      </div>

      {!canAnimate ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Ce parcours ne contient pas assez de distance pour lancer un survol.
        </p>
      ) : null}
    </section>
  );
}
