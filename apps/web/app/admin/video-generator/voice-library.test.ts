// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import {
  forgetVoice,
  getLastUsedVoiceId,
  loadVoiceLibrary,
  nameVoice,
  rememberVoice,
  sortVoices,
  storeVoiceLibrary,
  VOICE_LIBRARY_STORAGE_KEY,
} from "./voice-library";

const voice = (index: number) => `voice${String(index).padStart(4, "0")}abcdefgh`;

describe("voice library", () => {
  afterEach(() => window.localStorage.clear());

  it("keeps a short history of used voices, most recent first, and every named voice", () => {
    let voices = nameVoice([], voice(99), "Thomas posé", 1);
    for (let index = 0; index < 8; index += 1) voices = rememberVoice(voices, voice(index), 10 + index);
    // Using a voice again refreshes it instead of duplicating it.
    voices = rememberVoice(voices, voice(3), 100);

    const sorted = sortVoices(voices);
    expect(sorted[0]).toMatchObject({ id: voice(99), name: "Thomas posé" });
    expect(sorted.slice(1).map((entry) => entry.id)).toEqual([voice(3), voice(7), voice(6), voice(5), voice(4), voice(2)]);
    expect(getLastUsedVoiceId(voices)).toBe(voice(3));
    expect(forgetVoice(voices, voice(99)).some((entry) => entry.id === voice(99))).toBe(false);
  });

  it("ignores what does not look like a voice id", () => {
    expect(rememberVoice([], "not a voice!")).toEqual([]);
    expect(nameVoice([], "", "Vide")).toEqual([]);
  });

  it("survives reloads and corrupted storage", () => {
    storeVoiceLibrary(nameVoice([], voice(1), "Léa", 5));
    expect(loadVoiceLibrary()).toEqual([{ id: voice(1), name: "Léa", lastUsedAt: 5 }]);
    window.localStorage.setItem(VOICE_LIBRARY_STORAGE_KEY, "{broken");
    expect(loadVoiceLibrary()).toEqual([]);
  });
});
