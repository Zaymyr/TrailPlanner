// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { loadScriptNotes, SCRIPT_NOTES_STORAGE_KEY, storeScriptNotes } from "./script-notes";

describe("script notes", () => {
  afterEach(() => window.localStorage.clear());

  it("keeps the instructions per race and forgets an emptied one", () => {
    storeScriptNotes("race-a", "Bâtons interdits.");
    storeScriptNotes("race-b", "Insister sur la barrière.");
    expect(loadScriptNotes("race-a")).toBe("Bâtons interdits.");
    expect(loadScriptNotes("race-b")).toBe("Insister sur la barrière.");
    storeScriptNotes("race-a", "  ");
    expect(loadScriptNotes("race-a")).toBe("");
    expect(JSON.parse(window.localStorage.getItem(SCRIPT_NOTES_STORAGE_KEY) ?? "{}")).toEqual({ "race-b": "Insister sur la barrière." });
  });

  it("survives a missing race id or corrupt storage", () => {
    storeScriptNotes(undefined, "Rien.");
    expect(loadScriptNotes(undefined)).toBe("");
    window.localStorage.setItem(SCRIPT_NOTES_STORAGE_KEY, "{oops");
    expect(loadScriptNotes("race-a")).toBe("");
  });
});
