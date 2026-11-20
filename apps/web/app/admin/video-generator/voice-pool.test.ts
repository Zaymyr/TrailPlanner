// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PoolVoice } from "../../../lib/video-voices";
import { useVoicePool } from "./useVoicePool";
import { loadVoiceLibrary, nameVoice, rememberVoice, storeVoiceLibrary } from "./voice-library";
import {
  describeActiveVoices,
  getImportableVoices,
  OTHER_VOICE_CHOICE,
  pickPoolVoice,
  RANDOM_VOICE_CHOICE,
  resolveVoiceForGeneration,
} from "./voice-pool";

const voice = (index: number, active = true): PoolVoice => ({
  id: `id-${index}`,
  voiceId: `voice${String(index).padStart(4, "0")}abcdefgh`,
  name: `Voix ${index}`,
  active,
});

describe("pickPoolVoice", () => {
  const actives = [voice(1), voice(2), voice(3)];

  it("picks within the active voices, following the random source", () => {
    expect(pickPoolVoice(actives, null, () => 0)).toBe(actives[0]);
    expect(pickPoolVoice(actives, null, () => 0.5)).toBe(actives[1]);
    expect(pickPoolVoice(actives, null, () => 0.999)).toBe(actives[2]);
    // A random source returning exactly 1 never goes out of range.
    expect(pickPoolVoice(actives, null, () => 1)).toBe(actives[2]);
  });

  it("avoids the voice of the previous reel when there are two or more voices", () => {
    for (const value of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(pickPoolVoice(actives, actives[1].voiceId, () => value)?.voiceId).not.toBe(actives[1].voiceId);
    }
    expect(pickPoolVoice([voice(1), voice(2)], voice(1).voiceId, () => 0)).toEqual(voice(2));
  });

  it("returns the only voice even when it is the previous one, and null for an empty pool", () => {
    expect(pickPoolVoice([voice(1)], voice(1).voiceId, () => 0.4)).toEqual(voice(1));
    expect(pickPoolVoice([], null)).toBeNull();
    expect(pickPoolVoice([], voice(1).voiceId)).toBeNull();
  });

  it("ignores a previous voice that is no longer in the pool", () => {
    expect(pickPoolVoice(actives, "gone0000abcdefgh", () => 0)).toBe(actives[0]);
  });
});

describe("resolveVoiceForGeneration", () => {
  const pool = [voice(1), voice(2), voice(3, false)];
  const base = { choice: RANDOM_VOICE_CHOICE, pool, otherVoiceId: "", current: null, forceNew: false, random: () => 0 };

  it("draws an active voice for a narration without voice", () => {
    expect(resolveVoiceForGeneration(base)).toEqual({ voiceId: voice(1).voiceId, name: "Voix 1" });
  });

  it("keeps the saved voice when the voice is generated again, unless a new one is asked", () => {
    const current = { voiceId: voice(2).voiceId, name: "Voix 2" };
    expect(resolveVoiceForGeneration({ ...base, current })).toEqual(current);
    // A new reel (or « Changer de voix ») draws another voice than the previous one.
    expect(resolveVoiceForGeneration({ ...base, current, forceNew: true })).toEqual({ voiceId: voice(1).voiceId, name: "Voix 1" });
    expect(resolveVoiceForGeneration({ ...base, current: { voiceId: voice(1).voiceId, name: "Voix 1" }, forceNew: true }).voiceId).toBe(voice(2).voiceId);
  });

  it("never draws a deactivated voice", () => {
    for (const random of [0, 0.5, 0.99]) {
      expect(resolveVoiceForGeneration({ ...base, random: () => random }).voiceId).not.toBe(voice(3, false).voiceId);
    }
  });

  it("uses the chosen pool voice or the free id as is", () => {
    expect(resolveVoiceForGeneration({ ...base, choice: voice(2).voiceId, current: { voiceId: voice(1).voiceId, name: "Voix 1" }, forceNew: true }))
      .toEqual({ voiceId: voice(2).voiceId, name: "Voix 2" });
    expect(resolveVoiceForGeneration({ ...base, choice: OTHER_VOICE_CHOICE, otherVoiceId: "freeVoiceId12345" }))
      .toEqual({ voiceId: "freeVoiceId12345", name: null });
    expect(resolveVoiceForGeneration({ ...base, choice: OTHER_VOICE_CHOICE })).toEqual({ voiceId: null, name: null });
  });

  it("falls back to the free id, then to the server default, when no voice is active", () => {
    const inactive = [voice(1, false)];
    expect(resolveVoiceForGeneration({ ...base, pool: inactive, otherVoiceId: "freeVoiceId12345" })).toEqual({ voiceId: "freeVoiceId12345", name: null });
    expect(resolveVoiceForGeneration({ ...base, pool: [] })).toEqual({ voiceId: null, name: null });
  });

  it("describes the number of active voices", () => {
    expect(describeActiveVoices(pool)).toBe("Au hasard parmi 2 voix actives");
    expect(describeActiveVoices([voice(1)])).toBe("Au hasard parmi 1 voix active");
  });
});

describe("import of the saved browser voices", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  const seedLibrary = () => {
    let library = nameVoice([], voice(1).voiceId, "Thomas posé", 1);
    library = nameVoice(library, voice(2).voiceId, "Léa", 2);
    // History entries (no name) are not imported.
    library = rememberVoice(library, voice(7).voiceId, 3);
    storeVoiceLibrary(library);
    return loadVoiceLibrary();
  };

  it("lists the named voices of localStorage that the pool does not have", () => {
    const library = seedLibrary();
    expect(getImportableVoices(library, [])).toEqual([
      { voiceId: voice(1).voiceId, name: "Thomas posé" },
      { voiceId: voice(2).voiceId, name: "Léa" },
    ]);
    expect(getImportableVoices(library, [voice(1)])).toEqual([{ voiceId: voice(2).voiceId, name: "Léa" }]);
    expect(getImportableVoices(library, [voice(1), voice(2)])).toEqual([]);
  });

  it("copies them into the pool through the admin route, skipping duplicates", async () => {
    const library = seedLibrary();
    const posted: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method) return Response.json({ voices: [] });
      const body = JSON.parse(String(init.body)) as { voiceId: string; name: string };
      posted.push(body);
      // The first one is already in the pool by the time the import runs.
      if (posted.length === 1) return Response.json({ message: "Cette voix est déjà dans le pool." }, { status: 409 });
      return Response.json({ voice: { id: "new", voiceId: body.voiceId, name: body.name, active: true } }, { status: 201 });
    }));

    const { result } = renderHook(() => useVoicePool("admin-token", true));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    let added = 0;
    await act(async () => {
      added = await result.current.importLibrary(library);
    });

    expect(posted).toEqual([
      { voiceId: voice(1).voiceId, name: "Thomas posé" },
      { voiceId: voice(2).voiceId, name: "Léa" },
    ]);
    expect(added).toBe(1);
    expect(result.current.voices.map((item) => item.name)).toEqual(["Léa"]);
  });
});
