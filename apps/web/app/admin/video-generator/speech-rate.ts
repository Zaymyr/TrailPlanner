import { stripVoiceTags } from "./route-story";

/**
 * How fast a voice really speaks, measured on the clips it generated, so the next script is sized
 * to the reel length. Words are counted on the shown text (numbers in digits, as Claude writes
 * them), and the clip durations include the voice's pauses and numbers read in words, so the rate
 * already accounts for both. Kept per voice in this browser only (a convenience, not shared data).
 */
export const SPEECH_RATE_STORAGE_KEY = "py.videoGenerator.speechRates";
/** Used until a voice has been measured; a little below plain French speech, for tags and numbers. */
export const DEFAULT_WORDS_PER_SECOND = 2.2;
const MIN_MEASURED_MS = 10_000;

export const countWords = (text: string) => stripVoiceTags(text).text.split(/\s+/).filter(Boolean).length;

/** Words per second over the clips, or null when there is too little audio to trust. */
export const measureWordsPerSecond = (clips: Array<{ text: string; durationMs: number }>) => {
  const durationMs = clips.reduce((sum, clip) => sum + clip.durationMs, 0);
  const words = clips.reduce((sum, clip) => sum + countWords(clip.text), 0);
  if (durationMs < MIN_MEASURED_MS || words === 0) return null;
  return Math.min(4, Math.max(1, Math.round((words / (durationMs / 1_000)) * 100) / 100));
};

export const getSpeechRateKey = (model: string, voiceId: string | null) => `${model}:${voiceId || "default"}`;

export const loadSpeechRates = (): Record<string, number> => {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SPEECH_RATE_STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, number] =>
      typeof entry[1] === "number" && entry[1] >= 1 && entry[1] <= 4));
  } catch {
    return {};
  }
};

export const storeSpeechRates = (rates: Record<string, number>) => {
  try {
    window.localStorage.setItem(SPEECH_RATE_STORAGE_KEY, JSON.stringify(rates));
  } catch {
    // Private window or blocked storage: the default rate is used next time.
  }
};
