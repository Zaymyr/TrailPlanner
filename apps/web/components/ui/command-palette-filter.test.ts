import { describe, expect, it } from "vitest";

import { filterCommandItems, groupCommandItems, moveActiveIndex, normalizeSearchText, scoreCommandItem, type CommandItem } from "./command-palette-filter";

const items: CommandItem[] = [
  { id: "nav-overview", group: "Aller à", label: "Vue d’ensemble", keywords: ["dashboard"] },
  { id: "nav-studio", group: "Aller à", label: "Studio vidéo", keywords: ["générateur vidéo"] },
  { id: "nav-races", group: "Aller à", label: "Courses & événements", keywords: ["gpx"] },
  { id: "race-1", group: "Courses", label: "Trail des Aiguilles · 42 km" },
  { id: "race-2", group: "Courses", label: "Échappée belle" },
  { id: "user-1", group: "Coureurs", label: "alice@example.com", prefiltered: true },
];

describe("command palette filter", () => {
  it("normalizes case, accents and apostrophes", () => {
    expect(normalizeSearchText("  Vue d’Ensemble ÉTÉ ")).toBe("vue d ensemble ete");
  });

  it("shows the destinations, not the server results, for an empty query", () => {
    expect(filterCommandItems(items, "").map((item) => item.id)).toEqual(["nav-overview", "nav-studio", "nav-races", "race-1", "race-2"]);
  });

  it("matches accents, keywords and every word of the query", () => {
    expect(filterCommandItems(items, "echappee").map((item) => item.id)).toEqual(["race-2", "user-1"]);
    expect(filterCommandItems(items, "generateur").map((item) => item.id)).toEqual(["nav-studio", "user-1"]);
    expect(filterCommandItems(items, "trail 42").map((item) => item.id)).toEqual(["race-1", "user-1"]);
    expect(filterCommandItems(items, "trail 43").map((item) => item.id)).toEqual(["user-1"]);
  });

  it("ranks a label prefix before a word prefix before a keyword match, within each group", () => {
    const ranked: CommandItem[] = [
      { id: "keyword", group: "G", label: "Autre", keywords: ["course"] },
      { id: "word", group: "G", label: "Toutes les courses" },
      { id: "prefix", group: "G", label: "Courses & événements" },
    ];
    expect(filterCommandItems(ranked, "course").map((item) => item.id)).toEqual(["prefix", "word", "keyword"]);
    expect(scoreCommandItem(ranked[0], "zzz")).toBeNull();
  });

  it("caps each group", () => {
    const many = Array.from({ length: 12 }, (_, index): CommandItem => ({ id: `r${index}`, group: "Courses", label: `Course ${index}` }));
    expect(filterCommandItems(many, "course", { limitPerGroup: 5 })).toHaveLength(5);
  });

  it("groups consecutive items", () => {
    const grouped = groupCommandItems(filterCommandItems(items, "e"));
    expect(grouped.map((group) => group.group)).toEqual(["Aller à", "Courses", "Coureurs"]);
  });

  it("moves the active option with wrap-around", () => {
    expect(moveActiveIndex(-1, 3, "ArrowDown")).toBe(0);
    expect(moveActiveIndex(2, 3, "ArrowDown")).toBe(0);
    expect(moveActiveIndex(0, 3, "ArrowUp")).toBe(2);
    expect(moveActiveIndex(1, 3, "Home")).toBe(0);
    expect(moveActiveIndex(1, 3, "End")).toBe(2);
    expect(moveActiveIndex(0, 0, "ArrowDown")).toBe(-1);
  });
});
