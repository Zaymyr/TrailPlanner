/**
 * ElevenLabs voices the admin used or saved, kept in this browser only (a convenience, not shared
 * data): saved voices carry a name and stay; voices only used are a short recent history.
 */
export type SavedVoice = {
  id: string;
  /** Set when the admin saved the voice under a name; unnamed entries are history. */
  name: string | null;
  lastUsedAt: number;
};

export const VOICE_LIBRARY_STORAGE_KEY = "py.videoGenerator.voices";
const MAX_HISTORY = 6;
const VOICE_ID_PATTERN = /^[A-Za-z0-9]{8,64}$/;

export const isPlausibleVoiceId = (value: string) => VOICE_ID_PATTERN.test(value);

/** Named voices first (alphabetical), then the most recently used history entries. */
export const sortVoices = (voices: SavedVoice[]) => [
  ...voices.filter((voice) => voice.name).sort((left, right) => (left.name ?? "").localeCompare(right.name ?? "", "fr")),
  ...voices.filter((voice) => !voice.name).sort((left, right) => right.lastUsedAt - left.lastUsedAt),
];

const trimHistory = (voices: SavedVoice[]) => {
  const history = voices.filter((voice) => !voice.name).sort((left, right) => right.lastUsedAt - left.lastUsedAt);
  const dropped = new Set(history.slice(MAX_HISTORY).map((voice) => voice.id));
  return voices.filter((voice) => !dropped.has(voice.id));
};

export const rememberVoice = (voices: SavedVoice[], id: string, now = Date.now()) => {
  if (!isPlausibleVoiceId(id)) return voices;
  const existing = voices.find((voice) => voice.id === id);
  const next = existing
    ? voices.map((voice) => (voice.id === id ? { ...voice, lastUsedAt: now } : voice))
    : [...voices, { id, name: null, lastUsedAt: now }];
  return trimHistory(next);
};

export const nameVoice = (voices: SavedVoice[], id: string, name: string, now = Date.now()) => {
  const trimmed = name.trim().slice(0, 40);
  if (!isPlausibleVoiceId(id)) return voices;
  const existing = voices.find((voice) => voice.id === id);
  if (!existing) return trimHistory([...voices, { id, name: trimmed || null, lastUsedAt: now }]);
  return trimHistory(voices.map((voice) => (voice.id === id ? { ...voice, name: trimmed || null } : voice)));
};

export const forgetVoice = (voices: SavedVoice[], id: string) => voices.filter((voice) => voice.id !== id);

export const getLastUsedVoiceId = (voices: SavedVoice[]) =>
  [...voices].sort((left, right) => right.lastUsedAt - left.lastUsedAt)[0]?.id ?? null;

export const loadVoiceLibrary = (): SavedVoice[] => {
  try {
    const raw = window.localStorage.getItem(VOICE_LIBRARY_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SavedVoice =>
      Boolean(entry) &&
      typeof entry.id === "string" &&
      isPlausibleVoiceId(entry.id) &&
      (entry.name === null || typeof entry.name === "string") &&
      typeof entry.lastUsedAt === "number");
  } catch {
    return [];
  }
};

export const storeVoiceLibrary = (voices: SavedVoice[]) => {
  try {
    window.localStorage.setItem(VOICE_LIBRARY_STORAGE_KEY, JSON.stringify(voices));
  } catch {
    // Private window or blocked storage: the library just does not persist.
  }
};
