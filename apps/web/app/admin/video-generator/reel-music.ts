import { z } from "zod";

/**
 * Optional music bed of the reel (phase 6b). The tracks live in `public/reel-music/` and are
 * listed in its manifest; the shipped manifest is empty, the reel then has no music. Everything
 * here is pure: the gain envelope is computed sample by sample so the preview export and the
 * headless render mix the same way.
 */

export const REEL_MUSIC_BASE_PATH = "/reel-music";
export const REEL_MUSIC_MANIFEST_URL = `${REEL_MUSIC_BASE_PATH}/manifest.json`;

/** Voice-only loudness the music is mixed under, and the music bed level (8 LU below the voice). */
export const VOICE_PREMIX_LUFS = -16;
export const MUSIC_BED_LUFS = -24;
export const DUCK_DB = -10;
export const DUCK_ATTACK_MS = 150;
export const DUCK_RELEASE_MS = 400;
export const MUSIC_FADE_IN_MS = 500;
export const MUSIC_FADE_OUT_MS = 1_500;

export const reelMusicTrackSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  /** File name inside `public/reel-music/`. */
  file: z.string().regex(/^[\w.-]+\.(mp3|m4a|ogg|wav)$/i),
  mood: z.string().default(""),
  title: z.string().default(""),
  license: z.string().min(1),
  source: z.string().default(""),
});

export const reelMusicManifestSchema = z.object({ tracks: z.array(reelMusicTrackSchema).default([]) });

export type ReelMusicTrack = z.infer<typeof reelMusicTrackSchema>;
export type ReelMusicManifest = z.infer<typeof reelMusicManifestSchema>;

export const EMPTY_REEL_MUSIC_MANIFEST: ReelMusicManifest = { tracks: [] };

/** Invalid or missing manifests mean "no music", never an error. */
export const parseReelMusicManifest = (input: unknown): ReelMusicManifest => {
  const parsed = reelMusicManifestSchema.safeParse(input);
  return parsed.success ? parsed.data : EMPTY_REEL_MUSIC_MANIFEST;
};

export const getReelMusicTrackUrl = (track: ReelMusicTrack) => `${REEL_MUSIC_BASE_PATH}/${encodeURIComponent(track.file)}`;

/** FNV-1a: a stable string hash, so "auto" picks the same track for a race every time. */
const hashString = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

/** The track the setting designates: none, a given id (none when it is gone), or auto from the race id. */
export const resolveMusicTrack = (setting: string, raceId: string, manifest: ReelMusicManifest): ReelMusicTrack | null => {
  if (setting === "none" || manifest.tracks.length === 0) return null;
  if (setting === "auto") return manifest.tracks[hashString(raceId) % manifest.tracks.length];
  return manifest.tracks.find((track) => track.id === setting) ?? null;
};

export type TimeInterval = { startMs: number; endMs: number };

/**
 * Linear ducking gain per sample: 1 outside the voice, `duckDb` while it speaks. The fade down
 * starts `attackMs` before the voice (so the music is already down on its first syllable) and the
 * recovery takes `releaseMs` after it; overlapping intervals take the lowest gain.
 */
export const buildDuckEnvelope = (
  intervals: TimeInterval[],
  length: number,
  sampleRate: number,
  { duckDb = DUCK_DB, attackMs = DUCK_ATTACK_MS, releaseMs = DUCK_RELEASE_MS } = {},
) => {
  const envelope = new Float32Array(length).fill(1);
  const duck = 10 ** (duckDb / 20);
  const toSample = (ms: number) => (ms / 1_000) * sampleRate;
  for (const { startMs, endMs } of intervals) {
    const attackStart = toSample(startMs - attackMs);
    const holdStart = toSample(startMs);
    const holdEnd = toSample(endMs);
    const releaseEnd = toSample(endMs + releaseMs);
    const from = Math.max(0, Math.floor(attackStart));
    const to = Math.min(length - 1, Math.ceil(releaseEnd));
    for (let index = from; index <= to; index += 1) {
      let gain = duck;
      if (index < holdStart) gain = 1 - ((index - attackStart) / (holdStart - attackStart)) * (1 - duck);
      else if (index > holdEnd) gain = duck + ((index - holdEnd) / (releaseEnd - holdEnd)) * (1 - duck);
      envelope[index] = Math.min(envelope[index], Math.min(1, Math.max(duck, gain)));
    }
  }
  return envelope;
};

/** Loops or trims a track to `length` samples (both channels handled by the caller, one at a time). */
export const loopToLength = (source: Float32Array, length: number) => {
  const output = new Float32Array(length);
  if (source.length === 0) return output;
  for (let index = 0; index < length; index += 1) output[index] = source[index % source.length];
  return output;
};

/** Music fade-in at the start and fade-out over the end of the video, linear. */
export const buildMusicFades = (length: number, sampleRate: number, fadeInMs = MUSIC_FADE_IN_MS, fadeOutMs = MUSIC_FADE_OUT_MS) => {
  const fades = new Float32Array(length).fill(1);
  const fadeIn = Math.max(1, Math.round((fadeInMs / 1_000) * sampleRate));
  const fadeOut = Math.max(1, Math.round((fadeOutMs / 1_000) * sampleRate));
  for (let index = 0; index < Math.min(fadeIn, length); index += 1) fades[index] = index / fadeIn;
  for (let index = 0; index < Math.min(fadeOut, length); index += 1) fades[length - 1 - index] = Math.min(fades[length - 1 - index], index / fadeOut);
  return fades;
};

/**
 * Mixes the music bed under the voice, in place on `voice`: the music (already looped to length) is
 * scaled by `musicGain`, faded, ducked under the voice intervals and added.
 */
export const mixMusicUnderVoice = (voice: Float32Array[], music: Float32Array[], musicGain: number, intervals: TimeInterval[], sampleRate: number) => {
  const length = voice[0]?.length ?? 0;
  const envelope = buildDuckEnvelope(intervals, length, sampleRate);
  const fades = buildMusicFades(length, sampleRate);
  voice.forEach((channel, channelIndex) => {
    const track = music[Math.min(channelIndex, music.length - 1)];
    for (let index = 0; index < length; index += 1) channel[index] += track[index] * musicGain * envelope[index] * fades[index];
  });
};

/** Reads the manifest from the app origin (the admin preview and the render page alike); no file, no music. */
export const loadReelMusicManifest = async (): Promise<ReelMusicManifest> => {
  try {
    const response = await fetch(REEL_MUSIC_MANIFEST_URL, { cache: "no-store" });
    return response.ok ? parseReelMusicManifest(await response.json()) : EMPTY_REEL_MUSIC_MANIFEST;
  } catch {
    return EMPTY_REEL_MUSIC_MANIFEST;
  }
};
