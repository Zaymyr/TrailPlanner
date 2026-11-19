import { describe, expect, it } from "vitest";

import { measureIntegratedLoudness } from "./audio-master";
import {
  buildDuckEnvelope,
  buildMusicFades,
  DUCK_ATTACK_MS,
  DUCK_RELEASE_MS,
  loopToLength,
  mixMusicUnderVoice,
  parseReelMusicManifest,
  resolveMusicTrack,
  type ReelMusicManifest,
} from "./reel-music";

const FS = 48_000;
const track = (id: string) => ({ id, file: `${id}.mp3`, mood: "", title: id, license: "CC0", source: "" });
const manifest: ReelMusicManifest = { tracks: [track("calme"), track("energique"), track("epique")] };

describe("music manifest", () => {
  it("ships empty and treats invalid files as no music", () => {
    expect(parseReelMusicManifest({ tracks: [] }).tracks).toEqual([]);
    expect(parseReelMusicManifest(null).tracks).toEqual([]);
    expect(parseReelMusicManifest({ tracks: [{ id: "Bad Id", file: "x.mp3", license: "CC0" }] }).tracks).toEqual([]);
    expect(parseReelMusicManifest({ tracks: [{ id: "ok", file: "ok.mp3", license: "CC0" }] }).tracks).toHaveLength(1);
  });

  it("picks none, a given id, or a deterministic track for auto", () => {
    expect(resolveMusicTrack("auto", "race-1", { tracks: [] })).toBeNull();
    expect(resolveMusicTrack("none", "race-1", manifest)).toBeNull();
    expect(resolveMusicTrack("energique", "race-1", manifest)?.id).toBe("energique");
    expect(resolveMusicTrack("gone", "race-1", manifest)).toBeNull();
    const first = resolveMusicTrack("auto", "race-1", manifest);
    expect(first).not.toBeNull();
    expect(resolveMusicTrack("auto", "race-1", manifest)).toEqual(first);
    const picked = new Set(Array.from({ length: 40 }, (_, index) => resolveMusicTrack("auto", `race-${index}`, manifest)?.id));
    expect(picked.size).toBeGreaterThan(1);
  });
});

describe("ducking envelope", () => {
  const envelope = buildDuckEnvelope([{ startMs: 2_000, endMs: 4_000 }], FS * 6, FS);
  const at = (ms: number) => envelope[Math.round((ms / 1_000) * FS)];

  it("is 1 away from the voice and -10 dB while it speaks", () => {
    expect(at(0)).toBe(1);
    expect(at(1_000)).toBe(1);
    expect(at(3_000)).toBeCloseTo(10 ** (-10 / 20), 5);
    expect(at(5_000)).toBe(1);
  });

  it("falls over 150 ms before the voice and recovers over 400 ms after it", () => {
    const duck = 10 ** (-10 / 20);
    expect(at(2_000 - DUCK_ATTACK_MS)).toBeCloseTo(1, 4);
    expect(at(2_000 - DUCK_ATTACK_MS / 2)).toBeCloseTo((1 + duck) / 2, 3);
    expect(at(4_000 + DUCK_RELEASE_MS / 2)).toBeCloseTo((1 + duck) / 2, 3);
    expect(at(4_000 + DUCK_RELEASE_MS)).toBeCloseTo(1, 4);
  });

  it("stays ducked between two close clips and is deterministic", () => {
    const merged = buildDuckEnvelope([{ startMs: 1_000, endMs: 2_000 }, { startMs: 2_200, endMs: 3_000 }], FS * 4, FS);
    expect(merged[Math.round(2.1 * FS)]).toBeLessThan(0.9);
    expect(buildDuckEnvelope([{ startMs: 1_000, endMs: 2_000 }], FS * 4, FS)).toEqual(buildDuckEnvelope([{ startMs: 1_000, endMs: 2_000 }], FS * 4, FS));
  });
});

describe("music bed", () => {
  it("loops or trims to the video length", () => {
    expect(Array.from(loopToLength(Float32Array.from([1, 2, 3]), 7))).toEqual([1, 2, 3, 1, 2, 3, 1]);
    expect(Array.from(loopToLength(Float32Array.from([1, 2, 3, 4]), 2))).toEqual([1, 2]);
  });

  it("fades in over 0.5 s and out over the last 1.5 s", () => {
    const fades = buildMusicFades(FS * 10, FS);
    expect(fades[0]).toBe(0);
    expect(fades[Math.round(0.25 * FS)]).toBeCloseTo(0.5, 2);
    expect(fades[FS * 5]).toBe(1);
    expect(fades[FS * 10 - 1]).toBeCloseTo(0, 3);
    expect(fades[FS * 10 - Math.round(0.75 * FS)]).toBeCloseTo(0.5, 2);
  });

  it("adds the music under the voice, ducked while it speaks", () => {
    const length = FS * 4;
    const voice = [new Float32Array(length), new Float32Array(length)];
    const music = [new Float32Array(length).fill(0.1)];
    mixMusicUnderVoice(voice, music, 1, [{ startMs: 1_000, endMs: 2_000 }], FS);
    expect(voice[0][Math.round(0.5 * FS)]).toBeCloseTo(0.1, 5);
    expect(voice[1][Math.round(1.5 * FS)]).toBeCloseTo(0.1 * 10 ** (-10 / 20), 5);
    // Both channels carry the mono track.
    expect(voice[0][Math.round(3 * FS)]).toBeCloseTo(voice[1][Math.round(3 * FS)], 8);
  });

  it("measures a music track so its gain can be derived (-24 LUFS bed)", () => {
    const tone = Float32Array.from({ length: FS * 3 }, (_, index) => 0.2 * Math.sin(2 * Math.PI * 440 * (index / FS)));
    const lufs = measureIntegratedLoudness([tone, tone], FS);
    const gain = 10 ** ((-24 - lufs) / 20);
    const scaled = tone.map((value) => value * gain);
    expect(measureIntegratedLoudness([scaled, scaled], FS)).toBeCloseTo(-24, 1);
  });
});
