/**
 * Admin instructions for Claude, per race ("bâtons interdits"), kept in this browser only (a
 * convenience, not shared data) so they are there again for the next reel of the same race.
 */
export const SCRIPT_NOTES_STORAGE_KEY = "py.videoGenerator.scriptNotes";
export const SCRIPT_NOTES_MAX_LENGTH = 1_000;

export const loadScriptNotes = (raceId: string | undefined): string => {
  if (!raceId) return "";
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SCRIPT_NOTES_STORAGE_KEY) ?? "{}");
    const notes = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>)[raceId] : null;
    return typeof notes === "string" ? notes.slice(0, SCRIPT_NOTES_MAX_LENGTH) : "";
  } catch {
    return "";
  }
};

export const storeScriptNotes = (raceId: string | undefined, notes: string) => {
  if (!raceId) return;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SCRIPT_NOTES_STORAGE_KEY) ?? "{}");
    const all = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { ...(parsed as Record<string, string>) } : {};
    if (notes.trim()) all[raceId] = notes.slice(0, SCRIPT_NOTES_MAX_LENGTH);
    else delete all[raceId];
    window.localStorage.setItem(SCRIPT_NOTES_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Private window or blocked storage: the notes just do not persist.
  }
};
