import { describe, expect, it } from "vitest";

import { mapSpokenStartTimingToText, mapSpokenTimingToText, toSpokenText } from "../../../lib/spoken-numbers";
import { buildHighlightBeats, selectHighlights } from "./highlights";
import { buildRaceFigures, toRouteAidStations } from "./race-figures";
import { astragaleTrail, ultraDesDruides } from "./reel-race-fixtures";
import { prepareAnimationPath } from "./route-animation";
import { buildRaceClock } from "./route-clock";
import { getCumulativeGainAt, stripVoiceTags } from "./route-story";
import {
  buildSubtitleGroups,
  FRENCH_FUNCTION_WORDS,
  getSubtitleBoxBounds,
  getWordTimings,
  groupSubtitleWords,
  SUBTITLE_MAX_LINES,
  SUBTITLE_PAUSE_MS,
  SUBTITLE_RIGHT_RATIO,
  SUBTITLE_SAFE_BOTTOM_RATIO,
  type SubtitleWord,
} from "./subtitle-groups";
import { buildVideoTimeline, DEFAULT_VIDEO_COMPOSITION_SETTINGS } from "./video-composition";

const plainWords = (text: string): SubtitleWord[] => text.split(" ").map((word) => ({ text: word, startMs: null, endMs: null }));
const groupTexts = (text: string) => groupSubtitleWords(plainWords(text)).map((group) => group.map((word) => word.text).join(" "));

const lastWordOf = (group: string) => group.split(" ").pop()!.replace(/[’‘]/g, "'").toLowerCase().replace(/[.,;:!?…»]+$/u, "");
const isFunctionEnding = (group: string) => {
  const last = lastWordOf(group);
  return FRENCH_FUNCTION_WORDS.has(last) || last.endsWith("'");
};
const sentenceEnds = (group: string) => /[.!?…]$/u.test(group);

/** The structural rules every subtitle sequence must respect. */
const expectSoundGroups = (narration: string, groups: string[]) => {
  // The displayed text collapses every kind of space (the narrow no-break space of "2 276") to one.
  expect(groups.join(" ")).toBe(stripVoiceTags(narration).text);
  groups.forEach((group, index) => {
    const words = group.split(" ").filter((word) => !/^[?!:;»…]+$/u.test(word));
    const isSentenceFinal = sentenceEnds(group);
    // No singleton (the whole sentence may be one word).
    if (words.length < 2) expect(isSentenceFinal && (index === 0 || sentenceEnds(groups[index - 1]))).toBe(true);
    // Never more than 6 words (5 plus a merged name or number).
    expect(words.length, group).toBeLessThanOrEqual(6);
    // Never ends on a function word, except where the sentence ends.
    if (!isSentenceFinal) expect(isFunctionEnding(group), group).toBe(false);
    // A group never crosses a sentence end.
    expect(sentenceEnds(group.slice(0, -1)), group).toBe(false);
  });
};

describe("subtitle grouping", () => {
  it("cuts the bug-report sentence between noun phrases, never on « des » or « La »", () => {
    expect(groupTexts("Ça te dit de courir sur l’Hivernale des Templiers ?")).toEqual([
      "Ça te dit de courir",
      "sur l’Hivernale des Templiers ?",
    ]);
    expect(groupTexts("Ça grimpe dur jusqu’à La Comelle.")).toEqual(["Ça grimpe dur", "jusqu’à La Comelle."]);
  });

  it("keeps a number with its units together, and a lone figure sentence in one group", () => {
    expect(groupTexts("2 276 m D+.")).toEqual(["2 276 m D+."]);
    expect(groupTexts("Garde ton souffle pour 5 520 m D+ au total, vraiment.").join("|")).toContain("5 520 m D+");
    const groups = groupTexts("Ça monte à 13 % pendant 67 km avant l’arrivée à 18h12.");
    expect(groups.some((group) => group.includes("13 %"))).toBe(true);
    expect(groups.some((group) => group.includes("67 km"))).toBe(true);
    expect(groups.some((group) => group.includes("18h12"))).toBe(true);
    groups.forEach((group) => expect(/(^|\s)(13|67)$/.test(group)).toBe(false));
  });

  it("keeps proper-name sequences together", () => {
    const groups = groupTexts("Départ du Mont Beuvray puis ravito à La Comelle ensuite.");
    expect(groups.some((group) => group.includes("Mont Beuvray"))).toBe(true);
    expect(groups.some((group) => group.includes("La Comelle"))).toBe(true);
  });

  it("cuts at punctuation and never across a sentence end", () => {
    const text = "Premier ravito, ensuite la grande descente vers le lac. Allez, courage maintenant !";
    const groups = groupTexts(text);
    expectSoundGroups(text, groups);
    expect(groups.find((group) => group.includes("ravito,"))!.endsWith("ravito,")).toBe(true);
    expect(groups.some((group) => group.endsWith("lac."))).toBe(true);
  });

  it("keeps a one-word sentence as one group, and merges a trailing singleton", () => {
    expect(groupTexts("Bienvenue.")).toEqual(["Bienvenue."]);
    const groups = groupTexts("Ça descend sur toute la longueur du Gouffre.");
    groups.forEach((group) => expect(group.split(" ").length).toBeGreaterThanOrEqual(2));
  });

  it("cuts at a pause longer than 250 ms when start times exist", () => {
    // Eight words, every one 200 ms long, a 400 ms silence after the fourth.
    const words: SubtitleWord[] = Array.from({ length: 8 }, (_, index) => {
      const startMs = index * 200 + (index >= 4 ? 400 : 0);
      return { text: `mot${index}`, startMs, endMs: startMs + 200 };
    });
    words[7].text = "mot7.";
    const groups = groupSubtitleWords(words).map((group) => group.map((word) => word.text).join(" "));
    expect(groups).toEqual(["mot0 mot1 mot2 mot3", "mot4 mot5 mot6 mot7."]);
    expect(400).toBeGreaterThan(SUBTITLE_PAUSE_MS);
  });
});

describe("word timings", () => {
  const timingOf = (text: string) => {
    const { text: shown, rawIndex } = stripVoiceTags(text);
    return { shown, rawIndex };
  };

  it("derives the start and end of each displayed word from the character arrays", () => {
    const text = "[calm] Ça grimpe.";
    const { shown, rawIndex } = timingOf(text);
    const ends = Array.from(text, (_, index) => (index + 1) * 100);
    const starts = Array.from(text, (_, index) => index * 100);
    const words = getWordTimings(shown, rawIndex, 0, ends, starts);
    expect(words.map((word) => word.text)).toEqual(["Ça", "grimpe."]);
    // "Ça" is characters 7-8 of the raw text, "grimpe." characters 10-16.
    expect(words[0]).toMatchObject({ startMs: 700, endMs: 900 });
    expect(words[1]).toMatchObject({ startMs: 1000, endMs: 1700 });
  });

  it("maps the spoken timing of a number read in words back onto the digits", () => {
    const original = "Garde 13 % pour la fin.";
    const spokenText = toSpokenText(original);
    const spoken = spokenText.spoken;
    const ends = Array.from(spoken, (_, index) => (index + 1) * 10);
    const starts = Array.from(spoken, (_, index) => index * 10);
    const endMs = mapSpokenTimingToText(spokenText, ends);
    const startMs = mapSpokenStartTimingToText(spokenText, starts);
    expect(endMs).toHaveLength(original.length);
    expect(startMs).toHaveLength(endMs.length);
    // Every original character starts no later than it ends, and the sequence never goes backwards.
    startMs.forEach((value, index) => {
      expect(value).toBeLessThanOrEqual(endMs[index]);
      if (index > 0) {
        expect(value).toBeGreaterThanOrEqual(startMs[index - 1]);
        expect(endMs[index]).toBeGreaterThanOrEqual(endMs[index - 1]);
      }
    });
    // The first digit starts where the spoken number starts (right after "Garde ").
    expect(startMs[6]).toBe("Garde ".length * 10);
    const { shown, rawIndex } = timingOf(original);
    const words = getWordTimings(shown, rawIndex, 0, endMs, startMs);
    expect(words[1].startMs).toBe("Garde ".length * 10);
    expect(words[words.length - 1].endMs).toBe(endMs[endMs.length - 1]);
  });

  it("still times the groups from end times only (old clips) and falls back to length when there is no timing", () => {
    const text = "Départ du Musée de Bibracte. Ça grimpe dur jusqu’à La Comelle.";
    const { shown, rawIndex } = timingOf(text);
    const ends = Array.from(text, (_, index) => (index + 1) * 50);
    const base = { shown, rawIndex, rawOffset: 0, rawLength: text.length, durationMs: text.length * 50 };

    const endOnly = buildSubtitleGroups({ ...base, characterEndMs: ends });
    expect(endOnly.map((group) => group.text).join(" ")).toBe(text);
    expect(endOnly[0].startMs).toBe(0);
    expect(endOnly[endOnly.length - 1].endMs).toBe(ends[ends.length - 1]);
    endOnly.slice(1).forEach((group, index) => expect(group.startMs).toBe(endOnly[index].endMs));

    const withStarts = buildSubtitleGroups({ ...base, characterEndMs: ends, characterStartMs: ends.map((end) => end - 50) });
    expect(withStarts.map((group) => group.text)).toEqual(endOnly.map((group) => group.text));
    withStarts.forEach((group) => expect(group.endMs).toBeGreaterThan(group.startMs));

    const proportional = buildSubtitleGroups(base);
    expect(proportional[0].startMs).toBe(0);
    expect(proportional[proportional.length - 1].endMs).toBeCloseTo(base.durationMs, 6);
  });

  it("ignores a start-time array that does not cover the text", () => {
    const text = "Ça grimpe dur.";
    const { shown, rawIndex } = timingOf(text);
    const ends = Array.from(text, (_, index) => (index + 1) * 50);
    const groups = buildSubtitleGroups({ shown, rawIndex, rawOffset: 0, rawLength: text.length, durationMs: 700, characterEndMs: ends, characterStartMs: [0, 50] });
    expect(groups).toHaveLength(1);
    expect(groups[0].endMs).toBe(ends[ends.length - 1]);
  });
});

describe("subtitle layout", () => {
  it("keeps the box (two lines) above y = 1500 px and out of the right 15 % band at 1080x1920", () => {
    const box = getSubtitleBoxBounds(1080, 1920, SUBTITLE_MAX_LINES);
    expect(box.bottom).toBeLessThanOrEqual(1500);
    expect(box.bottom / 1920).toBeLessThanOrEqual(SUBTITLE_SAFE_BOTTOM_RATIO);
    // Vertically centred between 60 % and 70 % of the frame height.
    const centre = (box.top + box.bottom) / 2 / 1920;
    expect(centre).toBeGreaterThanOrEqual(0.6);
    expect(centre).toBeLessThanOrEqual(0.7);
    expect(box.left).toBeGreaterThanOrEqual(1080 * 0.06 - 1e-6);
    expect(box.right).toBeLessThanOrEqual(1080 * 0.85 + 1e-6);
    expect(SUBTITLE_RIGHT_RATIO).toBeLessThanOrEqual(0.85);
    // One line is shorter, never taller.
    expect(getSubtitleBoxBounds(1080, 1920, 1).bottom).toBeLessThan(box.bottom);
  });
});

const highlightsSettings = { ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, storyMode: "highlights" as const };

const fixtureBeats = (fixture: typeof astragaleTrail) => {
  const path = prepareAnimationPath(fixture.points);
  const figures = buildRaceFigures({
    raceDistanceKm: fixture.race.distanceKm,
    raceElevationGainM: fixture.race.elevationGainM,
    routeDistanceKm: path.totalDistanceKm,
    routeElevationGainM: getCumulativeGainAt(path, path.totalDistanceKm),
  });
  const stations = toRouteAidStations(figures, fixture.aidStations);
  const clock = buildRaceClock(path, stations, fixture.race);
  const highlights = selectHighlights(path, stations, clock, figures);
  const beats = buildHighlightBeats(highlights, path, fixture.race, { figures });
  return buildVideoTimeline(path, beats, highlightsSettings, {}, clock).beats;
};

describe("subtitles of the highlights reels on the test races", () => {
  // Written like the AI rewrites, with the cuts that used to read badly.
  const extraNarrations = [
    "Ça te dit de courir sur l’Hivernale des Templiers ? 67 km, 2 276 m D+.",
    "Ça grimpe sans pitié jusqu’à La Comelle. Garde du jus pour les 5 520 m D+ du Mont Beuvray.",
    "Au ravito de Sainte-Eulalie-de-Cernon, barrière à 18h12 : mange, bois, repars.",
  ];

  it.each([["Astragale Trail 67 km", astragaleTrail], ["L’Ultra des Druides 185 km", ultraDesDruides]] as const)("%s: no absurd cut", (_name, fixture) => {
    const beats = fixtureBeats(fixture);
    expect(beats.length).toBeGreaterThanOrEqual(5);
    beats.forEach((beat) => {
      const groups = beat.subtitles.map((line) => line.text);
      expectSoundGroups(beat.narration, groups);
      // Timed groups follow each other without overlapping.
      beat.subtitles.slice(1).forEach((line, index) => expect(line.startMs).toBeGreaterThanOrEqual(beat.subtitles[index].endMs - 1e-6));
    });
    extraNarrations.forEach((narration) => expectSoundGroups(narration, groupTexts(narration)));
  });
});
