import { describe, expect, it } from "vitest";

import { frenchNumberWords, mapSpokenTimingToText, toSpokenText } from "./spoken-numbers";

describe("frenchNumberWords", () => {
  it("follows French spelling rules", () => {
    expect([0, 1, 16, 17, 21, 31, 70, 71, 72, 80, 81, 90, 91, 99].map((value) => frenchNumberWords(value))).toEqual([
      "zéro", "un", "seize", "dix-sept", "vingt et un", "trente et un", "soixante-dix", "soixante et onze",
      "soixante-douze", "quatre-vingts", "quatre-vingt-un", "quatre-vingt-dix", "quatre-vingt-onze", "quatre-vingt-dix-neuf",
    ]);
    expect(frenchNumberWords(200)).toBe("deux cents");
    expect(frenchNumberWords(250)).toBe("deux cent cinquante");
    expect(frenchNumberWords(1_000)).toBe("mille");
    expect(frenchNumberWords(2_850)).toBe("deux mille huit cent cinquante");
    expect(frenchNumberWords(80_000)).toBe("quatre-vingt mille");
    expect(frenchNumberWords(200_000)).toBe("deux cent mille");
    expect(frenchNumberWords(21, true)).toBe("vingt et une");
  });
});

describe("toSpokenText", () => {
  const speak = (text: string) => toSpokenText(text).spoken;

  it("reads distances, elevation, grades and times the way people say them", () => {
    expect(speak("Ça grimpe : 850 m D+ sur 6,2 km, à 9 % de moyenne.")).toBe(
      "Ça grimpe : huit cent cinquante mètres de dénivelé positif sur six virgule deux kilomètres, à neuf pour cent de moyenne.",
    );
    expect(speak("Barrière à 14h30, départ 6h.")).toBe("Barrière à quatorze heures trente, départ six heures.");
    expect(speak("Ravito au km 12, puis 1 200 m de D+.")).toBe("Ravito au kilomètre douze, puis mille deux cents mètres de dénivelé positif.");
    expect(speak("1 km, 1er ravito, 21h, 2 000 D+.")).toBe("un kilomètre, premier ravito, vingt et une heures, deux mille de dénivelé positif.");
  });

  it("leaves words, voice tags and digits inside words alone", () => {
    expect(speak("[excited] Allez, la SaintéLyon, c'est parti !")).toBe("[excited] Allez, la SaintéLyon, c'est parti !");
    expect(speak("La A7 et le GR10.")).toBe("La A7 et le GR10.");
  });

  it("maps the voice timing back onto every original character", () => {
    const text = "Dans 6 km.";
    const spokenText = toSpokenText(text);
    expect(spokenText.spoken).toBe("Dans six kilomètres.");
    // One end time per spoken character: 10 ms each.
    const spokenTimes = [...spokenText.spoken].map((_, index) => (index + 1) * 10);
    const times = mapSpokenTimingToText(spokenText, spokenTimes);
    expect(times).toHaveLength(text.length);
    // "Dans " is unchanged; "6 km" ends where "six kilomètres" ends; the final dot last.
    expect(times.slice(0, 5)).toEqual([10, 20, 30, 40, 50]);
    expect(times[8]).toBe(190);
    expect(times[9]).toBe(200);
    expect([...times].sort((left, right) => left - right)).toEqual(times);
  });
});
