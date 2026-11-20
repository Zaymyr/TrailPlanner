"use client";

import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import React, { useEffect, useRef, useState } from "react";

import { CAROUSEL_SLIDE_HEIGHT, CAROUSEL_SLIDE_WIDTH, getSlideCount, parseCarouselSnapshot, type CarouselSnapshot } from "../../../../lib/carousels/carousel-snapshot";
import { CarouselStrip } from "./CarouselStrip";

// Self-hosted at build time: same origin, so html-to-image can embed them in the capture.
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "block" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-jetbrains", display: "block" });

type RenderStatus = { status: "loading" | "rendering" | "uploading" | "done" | "failed"; message?: string };

declare global {
  interface Window {
    __videoRender?: RenderStatus;
  }
}

/** JPEG quality of the slides (Instagram re-encodes; this keeps text crisp under 1 MB). */
const JPEG_QUALITY = 0.92;

const setStatus = (status: RenderStatus) => {
  window.__videoRender = status;
};

/** Waits for every font weight the slides use and every image, so the capture is deterministic. */
const waitForAssets = async (root: HTMLElement) => {
  const families = [bricolage.style.fontFamily, jetbrains.style.fontFamily];
  await Promise.all(families.flatMap((family) => ["500", "700", "800"].map((weight) => document.fonts.load(`${weight} 40px ${family}`))));
  await document.fonts.ready;
  await Promise.all(Array.from(root.querySelectorAll("img")).map((image) => image.decode().catch(() => undefined)));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
};

const toJpeg = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("JPEG impossible."))), "image/jpeg", JPEG_QUALITY);
});

/**
 * Carousel render page (Cloud Run headless Chrome): loads the snapshot with the job token, draws
 * the strip, captures it once, slices it into 1080 × 1350 JPEGs, uploads each one and reports.
 * The status protocol (`window.__videoRender`) is the reel renderer's, so the worker is shared.
 */
export function RenderCarouselClient({ jobId }: { jobId: string }) {
  const [snapshot, setSnapshot] = useState<CarouselSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const tokenRef = useRef<string | null>(null);
  const uploadUrlsRef = useRef<string[]>([]);

  const report = async (body: Record<string, unknown>) => {
    const response = await fetch(`/api/carousel-render/jobs/${jobId}`, {
      method: "POST",
      headers: { Authorization: `Render ${tokenRef.current ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Rapport refusé (${response.status}).`);
  };
  const reportRef = useRef(report);
  reportRef.current = report;

  const fail = (message: string) => {
    setError(message);
    setStatus({ status: "failed", message });
    void reportRef.current({ status: "failed", message: message.slice(0, 500) }).catch(() => undefined);
  };
  const failRef = useRef(fail);
  failRef.current = fail;

  useEffect(() => {
    setStatus({ status: "loading" });
    tokenRef.current = new URLSearchParams(window.location.hash.slice(1)).get("token");
    void (async () => {
      const response = await fetch(`/api/carousel-render/jobs/${jobId}`, { headers: { Authorization: `Render ${tokenRef.current ?? ""}` }, cache: "no-store" });
      if (!response.ok) throw new Error(`Rendu introuvable ou expiré (${response.status}).`);
      const payload = (await response.json()) as { snapshot: unknown; uploadUrls: string[] };
      const parsed = parseCarouselSnapshot(payload.snapshot);
      if (payload.uploadUrls.length !== getSlideCount(parsed)) throw new Error("Nombre d’images inattendu.");
      uploadUrlsRef.current = payload.uploadUrls;
      setSnapshot(parsed);
      setStatus({ status: "rendering" });
    })().catch((loadError: unknown) => failRef.current(loadError instanceof Error ? loadError.message : "Chargement du rendu impossible."));
  }, [jobId]);

  useEffect(() => {
    const root = stripRef.current;
    if (!snapshot || !root) return;
    void (async () => {
      await waitForAssets(root);
      const count = getSlideCount(snapshot);
      const width = count * CAROUSEL_SLIDE_WIDTH;
      const fontEmbedCSS = await getFontEmbedCSS(root);
      const strip = await toCanvas(root, { width, height: CAROUSEL_SLIDE_HEIGHT, canvasWidth: width, canvasHeight: CAROUSEL_SLIDE_HEIGHT, pixelRatio: 1, fontEmbedCSS, backgroundColor: "#FAF8F2" });
      setStatus({ status: "uploading" });
      for (let index = 0; index < count; index += 1) {
        const slide = document.createElement("canvas");
        slide.width = CAROUSEL_SLIDE_WIDTH;
        slide.height = CAROUSEL_SLIDE_HEIGHT;
        const context = slide.getContext("2d");
        if (!context) throw new Error("Canvas indisponible.");
        context.fillStyle = "#FAF8F2";
        context.fillRect(0, 0, CAROUSEL_SLIDE_WIDTH, CAROUSEL_SLIDE_HEIGHT);
        context.drawImage(strip, index * CAROUSEL_SLIDE_WIDTH, 0, CAROUSEL_SLIDE_WIDTH, CAROUSEL_SLIDE_HEIGHT, 0, 0, CAROUSEL_SLIDE_WIDTH, CAROUSEL_SLIDE_HEIGHT);
        const upload = await fetch(uploadUrlsRef.current[index], { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: await toJpeg(slide) });
        if (!upload.ok) throw new Error(`Envoi de l’image ${index + 1} refusé (${upload.status}).`);
      }
      await reportRef.current({ status: "done" });
      setStatus({ status: "done" });
    })().catch((captureError: unknown) => failRef.current(captureError instanceof Error ? captureError.message : "Capture impossible."));
  }, [snapshot]);

  if (error) return <p className="p-4 text-sm text-red-700">{error}</p>;
  if (!snapshot) return <p className="p-4 text-sm text-muted-foreground">Chargement du rendu…</p>;
  return (
    <div style={{ position: "absolute", left: 0, top: 0 }}>
      <CarouselStrip ref={stripRef} snapshot={snapshot} fontClassName={`${bricolage.variable} ${jetbrains.variable}`} />
    </div>
  );
}
