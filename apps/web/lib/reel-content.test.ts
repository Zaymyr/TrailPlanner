import { describe, expect, it } from "vitest";

import {
  assembleReelContent,
  buildDraftPrefill,
  buildNarrationOverrides,
  checkUnprovidedNumbers,
  collectAllowedNumbers,
  findUnprovidedNumbers,
  parseReelContent,
  reelContentSchema,
  sanitizeReelContent,
  type ReelContent,
} from "./reel-content";
import { buildDefaultCaption, DEFAULT_HASHTAGS } from "./social-posts";

const TAGS = ["trail", "trailrunning", "ultratrail", "paceyourself", "saintelyon", "nuit", "d_plus", "montagne", "course"];

const raw = (patch: Partial<ReelContent> = {}): ReelContent => ({
  hook: "185 km, ça se prépare ?",
  script_segments: [
    { highlight_id: "hl-intro", text: "185 km, ça se prépare ? Voici les moments clés." },
    { highlight_id: "hl-1", text: "La grosse montée du km 12 : mode diesel." },
    { highlight_id: "hl-outro", text: "Plan de course prêt, lien en bio." },
  ],
  cta: "Plan de course prêt, lien en bio.",
  caption: "Une course longue, des moments clés. Prépare ton plan de course dans l’appli Pace Yourself (lien en bio).",
  hashtags: TAGS,
  cover_text: "185 km de nuit",
  ...patch,
});

const budgets = [
  { id: "hl-intro", maxWords: 10 },
  { id: "hl-1", maxWords: 12 },
  { id: "hl-outro", maxWords: 8 },
];

describe("findUnprovidedNumbers", () => {
  it("accepts the numbers of the facts and flags the invented ones", () => {
    expect(findUnprovidedNumbers("Une montée de 6,2 km à 9 %, +850 m.", ["6,2 km", "9 %", "+850 m"])).toEqual([]);
    expect(findUnprovidedNumbers("Une montée de 7 km à 9 %.", ["6,2 km", "9 %"])).toEqual(["7"]);
  });

  it("reads French formats: narrow no-break spaces, decimal commas and percentages", () => {
    expect(findUnprovidedNumbers("5 520 m D+ et 12,5 km, soit 8 %", ["5 520", "12.5", 8])).toEqual([]);
    expect(findUnprovidedNumbers("5 520 m D+", ["5 520"])).toEqual([]);
    expect(findUnprovidedNumbers("5 521 m D+", ["5 520"])).toEqual(["5 521"]);
    expect(findUnprovidedNumbers("12,50 km", [12.5])).toEqual([]);
  });

  it("reads times as a whole, or by their hour when only the hour is given", () => {
    expect(findUnprovidedNumbers("Barrière à 18h12.", ["Samedi 18h12 au plus tard"])).toEqual([]);
    expect(findUnprovidedNumbers("Barrière à 18h40.", ["Samedi 18h12 au plus tard"])).toEqual(["18h40"]);
    expect(findUnprovidedNumbers("Vers 14h.", ["14h30"])).toEqual([]);
    expect(findUnprovidedNumbers("Vers 15h.", ["14h30"])).toEqual(["15"]);
  });

  it("does not take a thousands group for two figures when the facts give them apart", () => {
    expect(findUnprovidedNumbers("Au km 12 850 m de D+", ["km 12", "850 m"])).toEqual([]);
  });

  it("ignores 3D and keeps D+ figures", () => {
    expect(findUnprovidedNumbers("Le parcours en 3D, 850 m D+", [850])).toEqual([]);
    expect(findUnprovidedNumbers("850 D+", [])).toEqual(["850"]);
  });

  it("returns each invented number once, as written", () => {
    expect(findUnprovidedNumbers("Km 40, puis km 40 et 41,5 km.", ["km 12"])).toEqual(["40", "41,5"]);
  });

  it("collects the numbers of the race, the beats, the stations and the shock figure", () => {
    const allowed = collectAllowedNumbers({
      race: { title: "SaintéLyon 2026", subtitle: null, distanceKm: 82, elevationGainM: 2_300, startDetail: "Lyon · 23:30", raceDate: "2026-12-05" },
      beats: [
        { id: "hl-intro", kind: "intro", title: "SaintéLyon", startKm: 0, endKm: 0, facts: [], services: [], cutoffTime: null, narration: "", passages: [] },
        { id: "hl-1", kind: "climb", title: "Montée", startKm: 10, endKm: 16, facts: ["6 km", "+600 m à 9 %"], services: [], cutoffTime: "Samedi 14h30", narration: "", passages: [] },
        { id: "hl-outro", kind: "outro", title: "Pace Yourself", startKm: 82, endKm: 82, facts: [], services: [], cutoffTime: null, narration: "", passages: [] },
      ],
      shortName: "SaintéLyon",
      shockFigure: "2 300 m D+",
      aidStations: [{ name: "Saint-Étienne", km: 62.5, cutoffTime: "Dimanche 06h15" }],
    });
    const text = "SaintéLyon 2026 : 82 km, 2 300 m D+, 1 temps fort de 6 km à 9 %, +600 m, km 10 à 16, 14h30, km 62,5 avant 06h15.";
    expect(findUnprovidedNumbers(text, allowed)).toEqual([]);
    expect(findUnprovidedNumbers("Départ à 22h00, 83 km.", allowed)).toEqual(["22h00", "83"]);
  });
});

describe("reelContentSchema", () => {
  it("accepts the content and refuses a caption over Instagram's limit", () => {
    expect(reelContentSchema.safeParse(raw()).success).toBe(true);
    expect(reelContentSchema.safeParse(raw({ caption: "x".repeat(2_201) })).success).toBe(false);
    expect(parseReelContent(null)).toBeNull();
    expect(parseReelContent({ hook: 3 })).toBeNull();
  });
});

describe("sanitizeReelContent", () => {
  it("keeps a valid content without a problem", () => {
    const result = sanitizeReelContent(raw(), budgets);
    expect(result.problems).toEqual([]);
    expect(result.content.hashtags).toHaveLength(9);
  });

  it("maps one segment per beat: unknown ids are dropped and a repeated id is kept once", () => {
    const result = sanitizeReelContent(raw({
      script_segments: [
        { highlight_id: "hl-intro", text: "185 km, ça se prépare ?" },
        { highlight_id: "hl-1", text: "Première version." },
        { highlight_id: "hl-1", text: "Seconde version." },
        { highlight_id: "inconnu", text: "Inventé." },
        { highlight_id: "hl-outro", text: "Lien en bio." },
      ],
    }), budgets);
    expect(result.content.script_segments.map((segment) => segment.highlight_id)).toEqual(["hl-intro", "hl-1", "hl-outro"]);
    expect(result.content.script_segments[1].text).toBe("Première version.");
    expect(result.problems).toEqual([]);
  });

  it("reports a beat without text", () => {
    const result = sanitizeReelContent(raw({ script_segments: raw().script_segments.slice(0, 2) }), budgets);
    expect(result.problems).toEqual([expect.objectContaining({ field: "script_segments", message: expect.stringContaining("hl-outro") })]);
  });

  it("reports words over the budget of a beat, with a tolerance, and the intro up to the hook length", () => {
    const long = Array.from({ length: 20 }, () => "mot").join(" ");
    const result = sanitizeReelContent(raw({ script_segments: [
      raw().script_segments[0],
      { highlight_id: "hl-1", text: long },
      raw().script_segments[2],
    ] }), budgets);
    expect(result.problems.map((problem) => problem.message)).toEqual([expect.stringContaining("hl-1 : 20 mots pour 12")]);
    const twelveWords = "Un deux trois quatre cinq six sept huit neuf dix onze douze";
    const intro = sanitizeReelContent(raw({ hook: twelveWords, script_segments: [{ highlight_id: "hl-intro", text: twelveWords }, ...raw().script_segments.slice(1)] }), budgets);
    expect(intro.problems).toEqual([]);
  });

  it("limits the hook to 12 words and the cover text to 6", () => {
    const result = sanitizeReelContent(raw({ hook: "Un deux trois quatre cinq six sept huit neuf dix onze douze treize", cover_text: "un deux trois quatre cinq six sept" }), budgets);
    expect(result.problems.map((problem) => problem.field)).toEqual(expect.arrayContaining(["hook", "cover_text"]));
    expect(result.content.cover_text).toBe("un deux trois quatre cinq six sept");
  });

  it("asks for an intro that starts with the hook", () => {
    const result = sanitizeReelContent(raw({ hook: "Prêt pour la nuit ?" }), budgets);
    expect(result.problems).toEqual([expect.objectContaining({ field: "hook", message: expect.stringContaining("commencer") })]);
  });

  it("normalises hashtags (ASCII lowercase, unique), keeps 15 at most and wants 8 at least", () => {
    const messy = ["#Trail", "trail", "Ultra-Trail", "Saintélyon", "à_é", ...Array.from({ length: 20 }, (_, index) => `tag${index}`)];
    const many = sanitizeReelContent(raw({ hashtags: messy }), budgets);
    expect(many.content.hashtags).toHaveLength(15);
    expect(many.content.hashtags.slice(0, 4)).toEqual(["trail", "ultratrail", "saintelyon", "a_e"]);
    expect(many.problems).toEqual([]);
    const few = sanitizeReelContent(raw({ hashtags: ["trail", "#Trail", "ultra"] }), budgets);
    expect(few.content.hashtags).toEqual(["trail", "ultra"]);
    expect(few.problems).toEqual([expect.objectContaining({ field: "hashtags" })]);
  });

  it("cuts a caption over 2,200 characters and says so", () => {
    const result = sanitizeReelContent(raw({ caption: "a".repeat(2_300) }), budgets);
    expect(result.content.caption).toHaveLength(2_200);
    expect(result.problems).toEqual([expect.objectContaining({ field: "caption" })]);
  });
});

describe("checkUnprovidedNumbers", () => {
  it("flags a figure by field", () => {
    const warnings = checkUnprovidedNumbers(raw({ caption: "Un ultra de 190 km." }), ["185 km", "km 12"]);
    expect(warnings).toEqual([expect.objectContaining({ field: "caption", message: expect.stringContaining("190") })]);
    expect(checkUnprovidedNumbers(raw(), ["185 km", "km 12"])).toEqual([]);
  });
});

describe("editor helpers", () => {
  it("fills the narration texts and opens the intro with the hook when it is missing", () => {
    const overrides = buildNarrationOverrides(raw({ script_segments: [
      { highlight_id: "hl-intro", text: "Voici les moments clés." },
      { highlight_id: "hl-1", text: "La montée." },
    ] }));
    expect(overrides).toEqual({ "hl-intro": "185 km, ça se prépare ? Voici les moments clés.", "hl-1": "La montée." });
    expect(buildNarrationOverrides(raw())["hl-intro"]).toBe("185 km, ça se prépare ? Voici les moments clés.");
  });

  it("assembles the content from the current texts: hook from the intro, cta from the outro", () => {
    const content = assembleReelContent({
      base: raw(),
      narrations: [
        { id: "hl-intro", text: "Prêt pour la nuit ? Allons-y." },
        { id: "hl-1", text: "La montée." },
        { id: "hl-outro", text: "Le plan est prêt." },
      ],
      caption: "  Ma description ",
      hashtags: ["#Trail", "trail", "Ultra"],
      coverText: " Nuit longue ",
    });
    expect(content).toMatchObject({ hook: "Prêt pour la nuit ?", cta: "Le plan est prêt.", caption: "Ma description", hashtags: ["trail", "ultra"], cover_text: "Nuit longue" });
    expect(content.script_segments.map((segment) => segment.highlight_id)).toEqual(["hl-intro", "hl-1", "hl-outro"]);
    expect(reelContentSchema.safeParse(content).success).toBe(true);
  });
});

describe("buildDraftPrefill", () => {
  it("starts from the content of the video", () => {
    expect(buildDraftPrefill("SaintéLyon", raw())).toEqual({
      caption: raw().caption,
      hashtags: TAGS,
      coverText: "185 km de nuit",
    });
  });

  it("keeps today's template without content", () => {
    expect(buildDraftPrefill("SaintéLyon", null)).toEqual({
      caption: buildDefaultCaption("SaintéLyon"),
      hashtags: DEFAULT_HASHTAGS,
      coverText: null,
    });
  });
});
