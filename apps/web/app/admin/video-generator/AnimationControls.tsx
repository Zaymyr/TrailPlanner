"use client";

import React from "react";

import { Button } from "../../../components/ui/button";
import type { AnimationPlaybackSnapshot } from "./animation-controller";

const formatTime = (timeMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

type AnimationControlsProps = {
  canAnimate: boolean;
  currentDistanceKm: number;
  isReady: boolean;
  onPause: () => void;
  onPlay: () => void;
  onRestart: () => void;
  onSeek: (progress: number) => void;
  snapshot: AnimationPlaybackSnapshot;
  totalDistanceKm: number;
};

/** Compact transport bar kept under the phone preview so it stays visible without scrolling. */
export function AnimationControls({
  canAnimate,
  currentDistanceKm,
  isReady,
  onPause,
  onPlay,
  onRestart,
  onSeek,
  snapshot,
  totalDistanceKm,
}: AnimationControlsProps) {
  const controlsDisabled = !canAnimate || !isReady;

  return (
    <section className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground" aria-label="Lecture de l’animation">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          className="min-w-24"
          disabled={controlsDisabled}
          onClick={snapshot.isPlaying ? onPause : onPlay}
        >
          {snapshot.isPlaying ? "Pause" : "Lecture"}
        </Button>
        <Button type="button" variant="outline" disabled={controlsDisabled} onClick={onRestart}>
          Recommencer
        </Button>
        <input
          aria-label="Progression de l’animation"
          className="h-2 min-w-0 flex-1 cursor-pointer accent-brand disabled:cursor-not-allowed"
          type="range"
          min={0}
          max={1_000}
          step={1}
          disabled={controlsDisabled}
          value={Math.round(snapshot.progress * 1_000)}
          onChange={(event) => onSeek(Number(event.target.value) / 1_000)}
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 text-xs tabular-nums text-muted-foreground">
        <span>{formatTime(snapshot.currentTimeMs)} / {formatTime(snapshot.durationMs)}</span>
        <span>
          {currentDistanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
          {" / "}
          {totalDistanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km
        </span>
      </div>
      {!canAnimate ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Ce parcours ne contient pas assez de distance pour lancer un survol.
        </p>
      ) : null}
    </section>
  );
}
