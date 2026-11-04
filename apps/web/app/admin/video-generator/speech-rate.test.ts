import { describe, expect, it } from "vitest";

import { countWords, measureWordsPerSecond } from "./speech-rate";

describe("speech rate", () => {
  it("counts the shown words, without voice tags", () => {
    expect(countWords("[excited] Allez, 850 m D+ !")).toBe(5);
  });

  it("measures words per second over the clips, once there is enough audio", () => {
    const clip = { text: "un deux trois quatre cinq six sept huit neuf dix", durationMs: 5_000 };
    expect(measureWordsPerSecond([clip])).toBeNull();
    expect(measureWordsPerSecond([clip, clip, clip])).toBe(2);
  });
});
