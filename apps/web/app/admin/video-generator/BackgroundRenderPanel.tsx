"use client";

import React, { useCallback, useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import type { VideoRenderSnapshot } from "./render-snapshot";
import { VIDEO_RESOLUTIONS } from "./video-composition";

export type BackgroundRenderJob = {
  id: string;
  raceTitle: string;
  status: "uploading" | "queued" | "running" | "done" | "failed";
  progress: number;
  message: string | null;
  width: number;
  height: number;
  sizeBytes: number | null;
  createdAt: string;
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

type BackgroundRenderPanelProps = {
  accessToken: string;
  canRender: boolean;
  createSnapshot: () => VideoRenderSnapshot;
  hasVoice: boolean;
  raceId?: string;
  raceTitle: string;
  resolutionLabel: string;
};

const readMessage = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  return payload?.message ?? fallback;
};

/**
 * Background render on Google Cloud: the composition is saved, rendered by a headless browser in
 * Cloud Run and listed here when ready, so the admin can close the tab meanwhile.
 */
export function BackgroundRenderPanel({ accessToken, canRender, createSnapshot, hasVoice, raceId, raceTitle, resolutionLabel }: BackgroundRenderPanelProps) {
  const [jobs, setJobs] = useState<BackgroundRenderJob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);

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
    setJobs(Array.isArray(payload?.jobs) ? payload.jobs : []);
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
  }, [accessToken, hasActiveJob, loadJobs]);

  const submit = async () => {
    if (!raceId) return;
    setSubmitting(true);
    setError(null);
    try {
      const snapshot = createSnapshot();
      const base = VIDEO_RESOLUTIONS[snapshot.settings.resolution];
      const size = snapshot.settings.viewport === "portrait" ? base : { width: base.height, height: base.width };
      const created = await fetch("/api/admin/video-generator/render-jobs", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raceId, raceTitle, ...size }),
      });
      if (!created.ok) throw new Error(await readMessage(created, "Le rendu n’a pas pu être créé."));
      const { job, inputUploadUrl } = (await created.json()) as { job: { id: string }; inputUploadUrl: string };

      // The snapshot (route, narration, voice clips) goes straight to Cloud Storage: it can weigh
      // several megabytes, more than a serverless request body allows.
      const uploaded = await fetch(inputUploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      if (!uploaded.ok) throw new Error(`L’envoi de la composition a échoué (${uploaded.status}).`);

      const started = await fetch(`/api/admin/video-generator/render-jobs/${job.id}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!started.ok) throw new Error(await readMessage(started, "Le rendu n’a pas pu démarrer."));
      await loadJobs();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Le rendu n’a pas pu démarrer.");
      await loadJobs().catch(() => undefined);
    } finally {
      setSubmitting(false);
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
              </p>
              {job.status === "failed" && job.message ? <p className="text-[11px] text-red-700">{job.message}</p> : null}
              {job.downloadUrl ? (
                <a className="mt-1 inline-block font-semibold text-foreground underline underline-offset-2" href={job.downloadUrl}>
                  Télécharger le MP4
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
