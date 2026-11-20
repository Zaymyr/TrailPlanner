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

import { measureIntegratedLoudness, normalizeToMaster, type MasterReport } from "./audio-master";
import type { NarrationClip, NarrationCue } from "./narration-player";
import {
  getReelMusicTrackUrl,
  loopToLength,
  mixMusicUnderVoice,
  MUSIC_BED_LUFS,
  VOICE_PREMIX_LUFS,
  type ReelMusicTrack,
  type TimeInterval,
} from "./reel-music";

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
  /** Music bed under the voice, null for none (see reel-music.ts). */
  music?: ReelMusicTrack | null;
  /** Called once the soundtrack is mixed and normalised, with the measured loudness. */
  onSoundtrack?: (report: SoundtrackReport) => void;
  onProgress: (progress: ExportProgress) => void;
  signal: AbortSignal;
};

const AUDIO_SAMPLE_RATE = 48_000;

export type SoundtrackReport = {
  master: MasterReport;
  /** The music track mixed in, null when there is none. */
  music: ReelMusicTrack | null;
  /** True when a track was chosen but could not be loaded: the reel then has no music. */
  musicFailed: boolean;
};

/** Samples of the soundtrack buffer: exactly the video length, so no voice clip is ever cut short by it. */
export const getMixLengthSamples = (totalMs: number) => Math.max(1, Math.ceil((totalMs / 1_000) * AUDIO_SAMPLE_RATE));

export class ExportUnsupportedError extends Error {}

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
};

/**
 * Mixes the voice-over clips at their cue times into one buffer as long as the video, and returns
 * the time each clip really speaks (for the music ducking).
 */
export const mixNarration = async (clips: NarrationClip[], cues: NarrationCue[], totalMs: number) => {
  const context = new OfflineAudioContext(2, getMixLengthSamples(totalMs), AUDIO_SAMPLE_RATE);
  const byId = new Map(clips.map((clip) => [clip.beatId, clip]));
  const intervals: TimeInterval[] = [];
  await Promise.all(cues.map(async (cue) => {
    const clip = byId.get(cue.beatId);
    if (!clip) return;
    const buffer = await context.decodeAudioData(decodeBase64(clip.audioBase64));
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(Math.max(0, cue.startMs / 1_000));
    intervals.push({ startMs: Math.max(0, cue.startMs), endMs: Math.max(0, cue.startMs) + buffer.duration * 1_000 });
  }));
  return { buffer: await context.startRendering(), intervals };
};

const loadMusic = async (track: ReelMusicTrack) => {
  // Same origin as the page: the admin preview and the Cloud Run render page both serve /reel-music.
  const response = await fetch(getReelMusicTrackUrl(track), { cache: "force-cache" });
  if (!response.ok) throw new Error(`Musique introuvable (${response.status}).`);
  const context = new OfflineAudioContext(2, 1, AUDIO_SAMPLE_RATE);
  const decoded = await context.decodeAudioData(await response.arrayBuffer());
  return Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
};

/**
 * The final soundtrack: voice (leveled to -16 LUFS when a music bed goes under it), the music bed at
 * -24 LUFS ducked by 10 dB while the voice speaks, then the whole normalised to -14 LUFS with a
 * true peak of at most -1 dBTP. Plain Float32 math after decoding, so it is deterministic.
 */
export const buildSoundtrack = async (narration: { clips: NarrationClip[]; cues: NarrationCue[] } | null, totalMs: number, music: ReelMusicTrack | null) => {
  const { buffer, intervals } = narration ? await mixNarration(narration.clips, narration.cues, totalMs) : { buffer: null, intervals: [] };
  const length = getMixLengthSamples(totalMs);
  const channels = Array.from({ length: 2 }, (_, index) => (buffer ? Float32Array.from(buffer.getChannelData(index)) : new Float32Array(length)));

  let usedMusic: ReelMusicTrack | null = null;
  let musicFailed = false;
  if (music) {
    try {
      const track = await loadMusic(music);
      const trackLufs = measureIntegratedLoudness(track, AUDIO_SAMPLE_RATE);
      if (!Number.isFinite(trackLufs)) throw new Error("Musique silencieuse.");
      const voiceLufs = measureIntegratedLoudness(channels, AUDIO_SAMPLE_RATE);
      if (Number.isFinite(voiceLufs)) {
        const voiceGain = 10 ** ((VOICE_PREMIX_LUFS - voiceLufs) / 20);
        for (const channel of channels) for (let index = 0; index < channel.length; index += 1) channel[index] *= voiceGain;
      }
      const looped = track.map((channel) => loopToLength(channel, length));
      mixMusicUnderVoice(channels, looped, 10 ** ((MUSIC_BED_LUFS - trackLufs) / 20), intervals, AUDIO_SAMPLE_RATE);
      usedMusic = music;
    } catch {
      musicFailed = true;
    }
  }

  const master = normalizeToMaster(channels, AUDIO_SAMPLE_RATE);
  const output = new AudioBuffer({ numberOfChannels: 2, length, sampleRate: AUDIO_SAMPLE_RATE });
  channels.forEach((channel, index) => output.copyToChannel(channel, index));
  return { buffer: output, report: { master, music: usedMusic, musicFailed } satisfies SoundtrackReport };
};

/**
 * Deterministic frame-by-frame export: every frame time is `index / fps`, the map is drawn and
 * waited for before capture, so a slow machine only makes the export slower, never jerkier.
 * Frames are composited (map canvas, then the DOM overlay rasterised), encoded as H.264 with the
 * voice-over (and the optional music bed, mastered to -14 LUFS) as AAC, in an MP4 with the index at the start (Instagram friendly).
 */
export const exportVideo = async ({ width, height, fps, totalMs, driver, narration, music = null, onSoundtrack, onProgress, signal }: ExportOptions) => {
  const startedAt = performance.now();
  const totalFrames = Math.max(1, Math.round((totalMs / 1_000) * fps));
  // Satellite or shaded relief in motion compresses badly, and Instagram re-encodes on top: 16 Mb/s
  // at 1080p keeps paths and the route crisp in the source (≈ 2 MB per second of reel).
  const bitrate = height >= 1_920 || width >= 1_920 ? 16_000_000 : 3_500_000;
  if (typeof VideoEncoder === "undefined" || !(await canEncodeVideo("avc", { width, height, bitrate }))) {
    throw new ExportUnsupportedError("Ce navigateur ne sait pas encoder la vidéo en H.264 : utilise Chrome ou Edge à jour.");
  }
  const hasVoice = Boolean(narration && narration.cues.length > 0);
  const withAudio = hasVoice || Boolean(music);
  const aacConfig = { numberOfChannels: 2, sampleRate: AUDIO_SAMPLE_RATE, bitrate: 160_000 };
  if (withAudio && !(await canEncodeAudio("aac", aacConfig))) {
    // Chrome on Linux (the background renderer) and Firefox have no native AAC encoder: fall back
    // to the WASM build of FFmpeg's encoder, loaded only when needed.
    const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
    registerAacEncoder();
    if (!(await canEncodeAudio("aac", aacConfig))) {
      throw new ExportUnsupportedError("Ce navigateur ne sait pas encoder le son en AAC : utilise Chrome ou Edge à jour.");
    }
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
    if (audioSource) {
      const soundtrack = await buildSoundtrack(hasVoice ? narration : null, totalMs, music);
      onSoundtrack?.(soundtrack.report);
      await audioSource.add(soundtrack.buffer);
    }

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
