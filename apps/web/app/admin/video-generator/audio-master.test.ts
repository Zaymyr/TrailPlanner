import { describe, expect, it } from "vitest";

import {
  computeMasterGainDb,
  getKWeightingBiquads,
  measureIntegratedLoudness,
  measureLoudness,
  measureTruePeakDbtp,
  normalizeToMaster,
  TARGET_LUFS,
  TRUE_PEAK_CEILING_DBTP,
} from "./audio-master";

const FS = 48_000;
const sine = (frequency: number, amplitude: number, seconds: number, phase = 0) =>
  Float32Array.from({ length: Math.round(seconds * FS) }, (_, index) => amplitude * Math.sin(2 * Math.PI * frequency * (index / FS) + phase));
const dbfs = (db: number) => 10 ** (db / 20);
const getMaxAbs = (values: Float32Array) => values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);

describe("integrated loudness (BS.1770-4)", () => {
  it("reads a 997 Hz sine at -20 dBFS on both channels as about -20 LUFS", () => {
    // BS.1770 reference: a 997 Hz stereo sine at -20 dBFS reads -20.0 LUFS (K-weighting is ~0 dB
    // at 997 Hz, the two channels add 3 dB, the -0.691 offset removes it). Tolerance 0.3 LU.
    const channel = sine(997, dbfs(-20), 5);
    expect(Math.abs(measureIntegratedLoudness([channel, channel], FS) + 20)).toBeLessThan(0.3);
  });

  it("changes by exactly the applied gain", () => {
    const quiet = sine(997, dbfs(-30), 4);
    const loud = sine(997, dbfs(-24), 4);
    expect(measureIntegratedLoudness([loud, loud], FS) - measureIntegratedLoudness([quiet, quiet], FS)).toBeCloseTo(6, 1);
  });

  it("is gated on silence and on signals under 400 ms", () => {
    expect(measureIntegratedLoudness([new Float32Array(FS * 3), new Float32Array(FS * 3)], FS)).toBe(Number.NEGATIVE_INFINITY);
    const short = sine(997, 0.5, 0.2);
    expect(measureIntegratedLoudness([short, short], FS)).toBe(Number.NEGATIVE_INFINITY);
    expect(measureIntegratedLoudness([sine(997, dbfs(-80), 3)], FS)).toBe(Number.NEGATIVE_INFINITY);
  });

  it("ignores long silences through the relative gate", () => {
    const tone = sine(997, dbfs(-20), 3);
    const padded = new Float32Array(FS * 9);
    padded.set(tone, 0);
    // 6 s of digital silence after the tone: the gates drop it; only the 400 ms blocks straddling the end of the tone stay in (about 0.2 LU lower).
    expect(measureIntegratedLoudness([padded, padded], FS)).toBeCloseTo(measureIntegratedLoudness([tone, tone], FS) - 0.22, 1);
  });

  it("recomputes the K-weighting coefficients for other sample rates", () => {
    const [shelf48] = getKWeightingBiquads(48_000);
    // The 48 kHz shelf of the standard: b0 = 1.53512485958697, a1 = -1.69065929318241.
    expect(shelf48.b0).toBeCloseTo(1.53512485958697, 6);
    expect(shelf48.a1).toBeCloseTo(-1.69065929318241, 6);
    const rate = 44_100;
    const tone = Float32Array.from({ length: rate * 4 }, (_, index) => dbfs(-20) * Math.sin(2 * Math.PI * 997 * (index / rate)));
    expect(Math.abs(measureIntegratedLoudness([tone, tone], rate) + 20)).toBeLessThan(0.3);
  });
});

describe("true peak", () => {
  it("reads higher than the sample peak on an inter-sample-peak signal", () => {
    // fs/4 sine shifted by 45 degrees: every sample is +-0.7071 but the waveform reaches 1.0.
    const signal = Float32Array.from({ length: 4_800 }, (_, index) => Math.sin(2 * Math.PI * (FS / 4) * (index / FS) + Math.PI / 4));
    const samplePeakDb = 20 * Math.log10(0.7071);
    const truePeak = measureTruePeakDbtp([signal]);
    expect(truePeak).toBeGreaterThan(samplePeakDb + 2.5);
    expect(Math.abs(truePeak)).toBeLessThan(0.3);
  });

  it("matches the sample peak on a low-frequency sine and is -Infinity for silence", () => {
    expect(measureTruePeakDbtp([sine(100, 0.5, 1)])).toBeCloseTo(20 * Math.log10(0.5), 1);
    expect(measureTruePeakDbtp([new Float32Array(100)])).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("normalizeToMaster", () => {
  it("brings a quiet mix to -14 LUFS under the -1 dBTP ceiling", () => {
    const channel = sine(997, dbfs(-30), 5);
    const left = Float32Array.from(channel);
    const right = Float32Array.from(channel);
    const report = normalizeToMaster([left, right], FS);
    const after = measureLoudness([left, right], FS);
    expect(Math.abs(after.lufs - TARGET_LUFS)).toBeLessThan(0.5);
    expect(after.truePeakDbtp).toBeLessThanOrEqual(TRUE_PEAK_CEILING_DBTP);
    expect(report.limitedByPeak).toBe(false);
    expect(report.before.lufs).toBeCloseTo(-30, 0);
    expect(report.after.lufs).toBeCloseTo(after.lufs, 6);
  });

  it("lowers the gain to respect the true-peak ceiling and says so", () => {
    // Quiet bed with one loud spike: reaching -14 LUFS would put the peak far above -1 dBTP.
    const bed = sine(997, dbfs(-40), 5);
    const left = Float32Array.from(bed);
    left[FS * 2] = 0.9;
    const right = Float32Array.from(bed);
    const report = normalizeToMaster([left, right], FS);
    expect(report.limitedByPeak).toBe(true);
    expect(report.after.truePeakDbtp).toBeLessThanOrEqual(TRUE_PEAK_CEILING_DBTP + 0.01);
    expect(report.after.lufs).toBeLessThan(TARGET_LUFS);
  });

  it("leaves silence untouched", () => {
    const silent = [new Float32Array(FS), new Float32Array(FS)];
    const report = normalizeToMaster(silent, FS);
    expect(report.silent).toBe(true);
    expect(report.gainDb).toBe(0);
    expect(getMaxAbs(silent[0])).toBe(0);
  });

  it("computes the gain without touching the signal", () => {
    expect(computeMasterGainDb({ lufs: -20, truePeakDbtp: -10 })).toEqual({ gainDb: 6, limitedByPeak: false });
    expect(computeMasterGainDb({ lufs: -20, truePeakDbtp: -3 })).toEqual({ gainDb: 2, limitedByPeak: true });
  });
});
