"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { VideoGeneratorMap, type VideoRenderHooks } from "../../../admin/video-generator/VideoGeneratorMap";
import { parseRenderSnapshot, type VideoRenderSnapshot } from "../../../admin/video-generator/render-snapshot";

/** State read by the headless renderer (Playwright polls it). */
type RenderStatus = { status: "loading" | "rendering" | "uploading" | "done" | "failed"; message?: string };

declare global {
  interface Window {
    __videoRender?: RenderStatus;
  }
}

const PROGRESS_REPORT_MS = 5_000;

const setStatus = (status: RenderStatus) => {
  window.__videoRender = status;
};

/**
 * Background render page: loads the saved composition with the job token, lets the viewer export
 * it frame by frame exactly like the admin preview, uploads the MP4 and reports the outcome.
 */
export function RenderVideoClient({ jobId }: { jobId: string }) {
  const [snapshot, setSnapshot] = useState<VideoRenderSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const uploadUrlRef = useRef<string | null>(null);
  const lastReportRef = useRef(0);

  const report = useMemo(() => async (body: Record<string, unknown>) => {
    const response = await fetch(`/api/video-render/jobs/${jobId}`, {
      method: "POST",
      headers: { Authorization: `Render ${tokenRef.current ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Rapport refusé (${response.status}).`);
  }, [jobId]);

  const fail = useMemo(() => (message: string) => {
    setError(message);
    setStatus({ status: "failed", message });
    void report({ status: "failed", message: message.slice(0, 500) }).catch(() => undefined);
  }, [report]);

  useEffect(() => {
    setStatus({ status: "loading" });
    tokenRef.current = new URLSearchParams(window.location.hash.slice(1)).get("token");
    const controller = new AbortController();
    void (async () => {
      const response = await fetch(`/api/video-render/jobs/${jobId}`, {
        headers: { Authorization: `Render ${tokenRef.current ?? ""}` },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Rendu introuvable ou expiré (${response.status}).`);
      const { inputUrl, outputUploadUrl } = (await response.json()) as { inputUrl: string; outputUploadUrl: string };
      uploadUrlRef.current = outputUploadUrl;
      const input = await fetch(inputUrl, { cache: "no-store", signal: controller.signal });
      if (!input.ok) throw new Error(`Composition illisible (${input.status}).`);
      setSnapshot(parseRenderSnapshot(await input.json()));
      setStatus({ status: "rendering" });
    })().catch((loadError: unknown) => {
      if (controller.signal.aborted) return;
      // Without a valid token the report is refused too; the renderer then reports the timeout.
      fail(loadError instanceof Error ? loadError.message : "Chargement du rendu impossible.");
    });
    return () => controller.abort();
  }, [fail, jobId]);

  const hooks = useMemo<VideoRenderHooks | null>(() => snapshot && {
    snapshot,
    onProgress: (ratio) => {
      const now = Date.now();
      if (now - lastReportRef.current < PROGRESS_REPORT_MS) return;
      lastReportRef.current = now;
      void report({ status: "running", progress: Math.min(0.99, ratio) }).catch(() => undefined);
    },
    onComplete: (video) => {
      setStatus({ status: "uploading" });
      void (async () => {
        if (!uploadUrlRef.current) throw new Error("URL d’envoi absente.");
        const upload = await fetch(uploadUrlRef.current, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: video });
        if (!upload.ok) throw new Error(`Envoi de la vidéo refusé (${upload.status}).`);
        await report({ status: "done" });
        setStatus({ status: "done" });
      })().catch((uploadError: unknown) => fail(uploadError instanceof Error ? uploadError.message : "Envoi de la vidéo impossible."));
    },
    onError: fail,
  }, [fail, report, snapshot]);

  if (error) return <p className="p-4 text-sm text-red-700">{error}</p>;
  if (!snapshot || !hooks) return <p className="p-4 text-sm text-muted-foreground">Chargement du rendu…</p>;

  return (
    <div className="fixed left-0 top-0">
      <VideoGeneratorMap
        accessToken=""
        aidStations={snapshot.aidStations}
        bounds={snapshot.bounds}
        points={snapshot.points}
        race={snapshot.race}
        render={hooks}
      />
    </div>
  );
}
