import type { PoolVoice } from "../../../lib/video-voices";
import type { SavedVoice } from "./voice-library";

/**
 * Pure rules of the shared voice pool (table video_voices): the random pick of a reel's voice and
 * the one-time import of the browser's saved voices. The editor and the one-click reel share them.
 */

/** Default choice: a random active voice of the pool. */
export const RANDOM_VOICE_CHOICE = "random";
/** The free ElevenLabs id field (VoiceIdPicker). */
export const OTHER_VOICE_CHOICE = "other";

/** The voice a generation uses, and the one saved with the narration. `voiceId` null = server default. */
export type ChosenVoice = { voiceId: string | null; name: string | null };

/**
 * One active voice at random. With two or more actives the voice of the previous reel is left out,
 * so consecutive reels vary; with one, it is always that one. `random` is injectable for tests.
 */
export const pickPoolVoice = (
  active: PoolVoice[],
  previousVoiceId: string | null | undefined,
  random: () => number = Math.random,
): PoolVoice | null => {
  if (active.length === 0) return null;
  const candidates = active.length >= 2 ? active.filter((voice) => voice.voiceId !== previousVoiceId) : active;
  const pool = candidates.length > 0 ? candidates : active;
  return pool[Math.min(Math.floor(random() * pool.length), pool.length - 1)];
};

/**
 * The voice to generate with.
 * - A specific pool voice, or « Autre ID »: that voice.
 * - « Au hasard »: the voice the narration already has is kept (re-generating the voice does not
 *   change it), unless `forceNew` (a new reel, or « Changer de voix »), which picks another one.
 *   An empty pool falls back to the free id field, then to the server default.
 */
export const resolveVoiceForGeneration = ({ choice, pool, otherVoiceId, current, forceNew, random = Math.random }: {
  choice: string;
  pool: PoolVoice[];
  otherVoiceId: string;
  current: ChosenVoice | null;
  forceNew: boolean;
  random?: () => number;
}): ChosenVoice => {
  const fromId = (voiceId: string): ChosenVoice => ({ voiceId, name: pool.find((voice) => voice.voiceId === voiceId)?.name ?? null });
  if (choice === OTHER_VOICE_CHOICE) return otherVoiceId ? fromId(otherVoiceId) : { voiceId: null, name: null };
  if (choice !== RANDOM_VOICE_CHOICE) return fromId(choice);

  const active = pool.filter((voice) => voice.active);
  if (active.length === 0) return otherVoiceId ? fromId(otherVoiceId) : { voiceId: null, name: null };
  if (!forceNew && current?.voiceId) return current;
  const picked = pickPoolVoice(active, current?.voiceId, random);
  return picked ? { voiceId: picked.voiceId, name: picked.name } : { voiceId: null, name: null };
};

/** Voices the admin named in this browser that the pool does not have yet (history entries have no name). */
export const getImportableVoices = (library: SavedVoice[], pool: PoolVoice[]) => {
  const known = new Set(pool.map((voice) => voice.voiceId));
  return library
    .filter((voice): voice is SavedVoice & { name: string } => Boolean(voice.name?.trim()) && !known.has(voice.id))
    .map((voice) => ({ voiceId: voice.id, name: voice.name.trim().slice(0, 40) }));
};

export const describeActiveVoices = (pool: PoolVoice[]) => {
  const count = pool.filter((voice) => voice.active).length;
  return `Au hasard parmi ${count} ${count > 1 ? "voix actives" : "voix active"}`;
};
