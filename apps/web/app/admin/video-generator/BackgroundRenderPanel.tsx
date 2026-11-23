"use client";

import type { Route } from "next";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "../../../components/ui/button";
import { formatRenderDuration, renderPostHref, renderQueueHref } from "../../../lib/admin-renders";
import type { ReelContent } from "../../../lib/reel-content";
import { launchBackgroundRender, readRenderMessage as readMessage } from "./background-render";
import type { VideoRenderSnapshot } from "./render-snapshot";

export { formatRenderDuration };

export type BackgroundRenderJob = {
  id: string;
  /** Catalog race of the render (null for a flyover order). */
  raceId?: string | null;
  /** The Instagram draft or post made from this render, when there is one. */
  post?: { id: string; status: string } | null;
  raceTitle: string;
  status: "uploading" | "queued" | "running" | "done" | "failed";
  progress: number;
  message: string | null;
  width: number;
  height: number;
  sizeBytes: number | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  downloadUrl: string | null;
};

const STATUS_LABELS: Record<BackgroundRenderJob["status"], string> = {
  uploading: "Envoi…",
  queued: "En file d’attente",
  running: "Rendu en cours",
  done: "Prête",
  failed: "Échec",
};

const POLL_MS = 10_000;

// Done: computing time (and the wait before the job started); running: time so far.
const renderTiming = (job: BackgroundRenderJob) => {
  if (job.status === "done" || job.status === "failed") {
    const rendering = formatRenderDuration(job.startedAt, job.finishedAt);
    const total = formatRenderDuration(job.createdAt, job.finishedAt);
    if (!rendering) return total ? ` · ${total}` : "";
    return ` · ${job.status === "done" ? "rendu en" : "arrêté après"} ${rendering}${total && total !== rendering ? ` (${total} au total)` : ""}`;
  }
  if (job.status === "running" && job.startedAt) {
    const elapsed = formatRenderDuration(job.startedAt, new Date().toISOString());
    return elapsed ? ` · depuis ${elapsed}` : "";
  }
  return "";
};

type BackgroundRenderPanelProps = {
  accessToken: string;
  canRender: boolean;
  createSnapshot: () => VideoRenderSnapshot;
  hasVoice: boolean;
  /** Reel text of a highlights video, stored with the render job (null for full reels). */
  reelContent?: ReelContent | null;
  raceId?: string;
  raceTitle: string;
  resolutionLabel: string;
  /** Bumped by the one-click reel when it launches a render, to list it right away. */
  refreshSignal?: number;
  /** Called with the listed renders after each load (the studio offers a draft from the last finished one). */
  onJobsChange?: (jobs: BackgroundRenderJob[]) => void;
};

/**
 * Background render on Google Cloud: the composition is saved, rendered by a headless browser in
 * Cloud Run and listed here when ready, so the admin can close the tab meanwhile.
 */
export function BackgroundRenderPanel({ accessToken, canRender, createSnapshot, hasVoice, raceId, raceTitle, reelContent, resolutionLabel, refreshSignal = 0, onJobsChange }: BackgroundRenderPanelProps) {
  const [jobs, setJobs] = useState<BackgroundRenderJob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);

  const onJobsChangeRef = useRef(onJobsChange);
  onJobsChangeRef.current = onJobsChange;

  const loadJobs = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/admin/video-generator/render-jobs", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal,
    });
    if (response.status === 503) {
      setAvailable(false);
      return;
    }
    if (!response.ok) throw new Error(await readMessage(response, "Impossible de lister les rendus."));
    const payload = (await response.json().catch(() => null)) as { jobs?: BackgroundRenderJob[] } | null;
    setAvailable(true);
    const next = Array.isArray(payload?.jobs) ? payload.jobs : [];
    setJobs(next);
    onJobsChangeRef.current?.(next);
  }, [accessToken]);

  const hasActiveJob = jobs.some((job) => job.status === "queued" || job.status === "running" || job.status === "uploading");
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    void loadJobs(controller.signal).catch(() => undefined);
    if (!hasActiveJob) return () => controller.abort();
    const timer = window.setInterval(() => void loadJobs(controller.signal).catch(() => undefined), POLL_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [accessToken, hasActiveJob, loadJobs, refreshSignal]);

  // A render that just finished: read the list once more so its automatic draft shows up.
  const wasActive = useRef(false);
  useEffect(() => {
    if (!accessToken) return;
    const finished = wasActive.current && !hasActiveJob;
    wasActive.current = hasActiveJob;
    if (!finished) return;
    const timer = window.setTimeout(() => void loadJobs().catch(() => undefined), 3_000);
    return () => window.clearTimeout(timer);
  }, [accessToken, hasActiveJob, loadJobs]);

  const submit = async () => {
    if (!raceId) return;
    setSubmitting(true);
    setError(null);
    try {
      // The snapshot (route, narration, voice clips) goes straight to Cloud Storage (see launchBackgroundRender).
      await launchBackgroundRender({ accessToken, raceId, raceTitle, snapshot: createSnapshot(), content: reelContent });
      await loadJobs();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Le rendu n’a pas pu démarrer.");
      await loadJobs().catch(() => undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const remove = async (job: BackgroundRenderJob) => {
    if (!window.confirm(`Supprimer la vidéo « ${job.raceTitle} » (${job.width}×${job.height}) ? Le MP4 ne pourra plus être téléchargé.`)) return;
    setDeletingId(job.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/video-generator/render-jobs/${job.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error(await readMessage(response, "La vidéo n’a pas pu être supprimée."));
      setJobs((current) => current.filter((entry) => entry.id !== job.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "La vidéo n’a pas pu être supprimée.");
    } finally {
      setDeletingId(null);
    }
  };

  if (!available) {
    return <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">Rendu en arrière-plan non configuré sur cet environnement.</p>;
  }

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3 text-foreground">
      <Button type="button" variant="outline" className="h-9 w-full px-2 text-xs" disabled={!canRender || !raceId || submitting} onClick={() => void submit()}>
        {submitting ? "Envoi de la composition…" : `Générer en arrière-plan (${resolutionLabel})`}
      </Button>
      <p className="text-xs text-muted-foreground">
        Rendu sur Google Cloud {hasVoice ? "avec la voix off" : "sans voix off"} : tu peux fermer l’onglet, la vidéo apparaît ici une fois prête.
      </p>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <p className="text-xs">
        <Link href={renderQueueHref() as Route} className="font-semibold text-brand underline underline-offset-2">Voir tous les rendus →</Link>
      </p>
      {jobs.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Rendus en arrière-plan">
          {jobs.map((job) => (
            <li key={job.id} className="rounded-md border border-border px-2 py-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{job.raceTitle}</span>
                <span className={job.status === "failed" ? "text-red-700" : job.status === "done" ? "text-brand" : "text-muted-foreground"}>
                  {STATUS_LABELS[job.status]}{job.status === "running" ? ` · ${Math.round(job.progress * 100)} %` : ""}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {new Date(job.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} · {job.width}×{job.height}
                {job.sizeBytes ? ` · ${(job.sizeBytes / 1_048_576).toFixed(1)} Mo` : ""}
                {renderTiming(job)}
              </p>
              {job.status === "failed" && job.message ? <p className="text-[11px] text-red-700">{job.message}</p> : null}
              <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {job.downloadUrl ? (
                    <a className="font-semibold text-foreground underline underline-offset-2" href={job.downloadUrl}>
                      Télécharger le MP4
                    </a>
                  ) : null}
                  <Link className="text-[11px] font-semibold text-brand underline underline-offset-2" href={renderQueueHref(job.id) as Route}>Voir dans la file</Link>
                  {job.post ? (
                    <Link className="text-[11px] font-semibold text-brand underline underline-offset-2" href={renderPostHref({ ...job.post, media_type: "reel" }) as Route}>
                      {job.post.status === "draft" ? "Voir le brouillon" : "Voir la publication"}
                    </Link>
                  ) : null}
                </span>
                {job.status === "done" || job.status === "failed" ? (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground underline-offset-2 hover:text-red-700 hover:underline disabled:opacity-50"
                    disabled={deletingId === job.id}
                    onClick={() => void remove(job)}
                  >
                    {deletingId === job.id ? "Suppression…" : "Supprimer"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
