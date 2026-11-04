import { getFontEmbedCSS, toCanvas } from "html-to-image";
import {
  AudioBufferSource,
  BufferTarget,
  canEncodeAudio,
  canEncodeVideo,
  CanvasSource,
  Mp4OutputFormat,
  Output,
} from "mediabunny";

import type { NarrationClip, NarrationCue } from "./narration-player";

export type ExportPhase = "preparing" | "rendering" | "finalizing";

export type ExportProgress = {
  phase: ExportPhase;
  frame: number;
  totalFrames: number;
  elapsedMs: number;
};

/**
 * What the export needs from the viewer: draw one moment of the video into the map and the
 * overlay, resolved once both are ready to be captured (tiles loaded, layout updated).
 */
export type ExportFrameDriver = {
  renderFrame: (timeMs: number) => Promise<void>;
  /** The Mapbox canvas, created with `preserveDrawingBuffer` so it can be read after rendering. */
  mapCanvas: () => HTMLCanvasElement;
  /** The preview frame: overlay, markers and Mapbox logo; its own canvas is skipped. */
  frameElement: () => HTMLElement;
};

export type ExportOptions = {
  width: number;
  height: number;
  fps: number;
  totalMs: number;
  driver: ExportFrameDriver;
  narration: { clips: NarrationClip[]; cues: NarrationCue[] } | null;
  onProgress: (progress: ExportProgress) => void;
  signal: AbortSignal;
};

const AUDIO_SAMPLE_RATE = 48_000;

export class ExportUnsupportedError extends Error {}

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
};

/** Mixes the voice-over clips at their cue times into one buffer as long as the video. */
export const mixNarration = async (clips: NarrationClip[], cues: NarrationCue[], totalMs: number) => {
  const length = Math.max(1, Math.ceil((totalMs / 1_000) * AUDIO_SAMPLE_RATE));
  const context = new OfflineAudioContext(2, length, AUDIO_SAMPLE_RATE);
  const byId = new Map(clips.map((clip) => [clip.beatId, clip]));
  await Promise.all(cues.map(async (cue) => {
    const clip = byId.get(cue.beatId);
    if (!clip) return;
    const buffer = await context.decodeAudioData(decodeBase64(clip.audioBase64));
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(Math.max(0, cue.startMs / 1_000));
  }));
  return context.startRendering();
};

/**
 * Deterministic frame-by-frame export: every frame time is `index / fps`, the map is drawn and
 * waited for before capture, so a slow machine only makes the export slower, never jerkier.
 * Frames are composited (map canvas, then the DOM overlay rasterised), encoded as H.264 with the
 * voice-over as AAC, in an MP4 with the index at the start (Instagram friendly).
 */
export const exportVideo = async ({ width, height, fps, totalMs, driver, narration, onProgress, signal }: ExportOptions) => {
  const startedAt = performance.now();
  const totalFrames = Math.max(1, Math.round((totalMs / 1_000) * fps));
  const bitrate = height >= 1_920 || width >= 1_920 ? 10_000_000 : 3_500_000;
  if (typeof VideoEncoder === "undefined" || !(await canEncodeVideo("avc", { width, height, bitrate }))) {
    throw new ExportUnsupportedError("Ce navigateur ne sait pas encoder la vidéo en H.264 : utilise Chrome ou Edge à jour.");
  }
  const withAudio = Boolean(narration && narration.cues.length > 0);
  if (withAudio && !(await canEncodeAudio("aac", { numberOfChannels: 2, sampleRate: AUDIO_SAMPLE_RATE, bitrate: 160_000 }))) {
    throw new ExportUnsupportedError("Ce navigateur ne sait pas encoder le son en AAC : utilise Chrome ou Edge à jour.");
  }

  onProgress({ phase: "preparing", frame: 0, totalFrames, elapsedMs: 0 });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new ExportUnsupportedError("Impossible de créer le canevas d’export.");

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
  const videoSource = new CanvasSource(canvas, { codec: "avc", bitrate, keyFrameInterval: 2 });
  output.addVideoTrack(videoSource, { frameRate: fps });
  const audioSource = withAudio ? new AudioBufferSource({ codec: "aac", bitrate: 160_000 }) : null;
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start();

  try {
    if (audioSource && narration) await audioSource.add(await mixNarration(narration.clips, narration.cues, totalMs));

    // Fonts are embedded once; every frame reuses them.
    const fontEmbedCSS = await getFontEmbedCSS(driver.frameElement());
    for (let frame = 0; frame < totalFrames; frame += 1) {
      if (signal.aborted) throw new DOMException("Export annulé.", "AbortError");
      await driver.renderFrame((frame * 1_000) / fps);
      context.clearRect(0, 0, width, height);
      context.drawImage(driver.mapCanvas(), 0, 0, width, height);
      const overlay = await toCanvas(driver.frameElement(), {
        canvasWidth: width,
        canvasHeight: height,
        pixelRatio: 1,
        fontEmbedCSS,
        backgroundColor: "transparent",
        filter: (node) => node.tagName !== "CANVAS",
      });
      context.drawImage(overlay, 0, 0, width, height);
      await videoSource.add(frame / fps, 1 / fps);
      onProgress({ phase: "rendering", frame: frame + 1, totalFrames, elapsedMs: performance.now() - startedAt });
    }

    onProgress({ phase: "finalizing", frame: totalFrames, totalFrames, elapsedMs: performance.now() - startedAt });
    await output.finalize();
  } catch (error) {
    await output.cancel().catch(() => undefined);
    throw error;
  }
  if (!target.buffer) throw new Error("La vidéo exportée est vide.");
  return new Blob([target.buffer], { type: "video/mp4" });
};
