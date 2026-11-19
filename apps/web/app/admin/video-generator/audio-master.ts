/**
 * Loudness master of the reel soundtrack, pure and deterministic (no Web Audio, no ffmpeg), so the
 * browser preview export and the headless Chrome render give the same numbers.
 *
 * - Integrated loudness: ITU-R BS.1770-4 / EBU R128 (K-weighting, 400 ms blocks every 100 ms,
 *   absolute gate -70 LUFS, relative gate -10 LU, L and R summed with unit weights).
 * - True peak: 4x oversampling with a Hann-windowed sinc, maximum absolute value in dBTP.
 * - Normalisation: one linear gain to -14 LUFS, lowered when the true peak would exceed -1 dBTP.
 */

export const TARGET_LUFS = -14;
export const TRUE_PEAK_CEILING_DBTP = -1;

const ABSOLUTE_GATE_LUFS = -70;
const RELATIVE_GATE_LU = -10;
const BLOCK_SECONDS = 0.4;
const BLOCK_STEP_SECONDS = 0.1;
const OVERSAMPLING = 4;
const SINC_HALF_TAPS = 8;

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

/** The two K-weighting biquads of BS.1770, recomputed for any sample rate (standard prototype). */
export const getKWeightingBiquads = (sampleRate: number): [Biquad, Biquad] => {
  // Stage 1: high shelf (+4 dB above about 1.5 kHz) modelling the head.
  const shelfF0 = 1_681.974450955533;
  const shelfGainDb = 3.999843853973347;
  const shelfQ = 0.7071752369554196;
  let k = Math.tan((Math.PI * shelfF0) / sampleRate);
  const vh = 10 ** (shelfGainDb / 20);
  const vb = vh ** 0.4996667741545416;
  let a0 = 1 + k / shelfQ + k * k;
  const shelf: Biquad = {
    b0: (vh + (vb * k) / shelfQ + k * k) / a0,
    b1: (2 * (k * k - vh)) / a0,
    b2: (vh - (vb * k) / shelfQ + k * k) / a0,
    a1: (2 * (k * k - 1)) / a0,
    a2: (1 - k / shelfQ + k * k) / a0,
  };
  // Stage 2: RLB high-pass at about 38 Hz.
  const highPassF0 = 38.13547087602444;
  const highPassQ = 0.5003270373238773;
  k = Math.tan((Math.PI * highPassF0) / sampleRate);
  a0 = 1 + k / highPassQ + k * k;
  const highPass: Biquad = { b0: 1, b1: -2, b2: 1, a1: (2 * (k * k - 1)) / a0, a2: (1 - k / highPassQ + k * k) / a0 };
  return [shelf, highPass];
};

const applyBiquad = (input: Float64Array, { b0, b1, b2, a1, a2 }: Biquad) => {
  const output = new Float64Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let index = 0; index < input.length; index += 1) {
    const x0 = input[index];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    output[index] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return output;
};

const kWeight = (channel: Float32Array, sampleRate: number) => {
  const [shelf, highPass] = getKWeightingBiquads(sampleRate);
  return applyBiquad(applyBiquad(Float64Array.from(channel), shelf), highPass);
};

/**
 * Integrated loudness in LUFS of a multichannel signal (every channel weighted 1, as for L and R).
 * Returns -Infinity when no block passes the gates (silence or under 400 ms).
 */
export const measureIntegratedLoudness = (channels: Float32Array[], sampleRate: number) => {
  const length = channels[0]?.length ?? 0;
  const blockLength = Math.round(BLOCK_SECONDS * sampleRate);
  const stepLength = Math.round(BLOCK_STEP_SECONDS * sampleRate);
  if (channels.length === 0 || length < blockLength) return Number.NEGATIVE_INFINITY;

  // Running sums of squares make every 400 ms block a subtraction.
  const cumulative = channels.map((channel) => {
    const weighted = kWeight(channel, sampleRate);
    const sums = new Float64Array(length + 1);
    for (let index = 0; index < length; index += 1) sums[index + 1] = sums[index] + weighted[index] * weighted[index];
    return sums;
  });

  const energies: number[] = [];
  for (let start = 0; start + blockLength <= length; start += stepLength) {
    let energy = 0;
    for (const sums of cumulative) energy += (sums[start + blockLength] - sums[start]) / blockLength;
    energies.push(energy);
  }

  const toLufs = (energy: number) => -0.691 + 10 * Math.log10(energy);
  const absolute = energies.filter((energy) => energy > 0 && toLufs(energy) > ABSOLUTE_GATE_LUFS);
  if (absolute.length === 0) return Number.NEGATIVE_INFINITY;
  const relativeThreshold = toLufs(absolute.reduce((sum, energy) => sum + energy, 0) / absolute.length) + RELATIVE_GATE_LU;
  const gated = absolute.filter((energy) => toLufs(energy) > relativeThreshold);
  if (gated.length === 0) return Number.NEGATIVE_INFINITY;
  return toLufs(gated.reduce((sum, energy) => sum + energy, 0) / gated.length);
};

/** Hann-windowed sinc coefficients of the 3 inter-sample phases of a 4x oversampler. */
const buildInterpolationPhases = () =>
  Array.from({ length: OVERSAMPLING - 1 }, (_, phaseIndex) => {
    const fraction = (phaseIndex + 1) / OVERSAMPLING;
    return Float64Array.from({ length: SINC_HALF_TAPS * 2 }, (_, tap) => {
      const offset = tap - SINC_HALF_TAPS + 1; // sample n + offset
      const distance = offset - fraction;
      const sinc = distance === 0 ? 1 : Math.sin(Math.PI * distance) / (Math.PI * distance);
      const window = 0.5 * (1 + Math.cos((Math.PI * distance) / SINC_HALF_TAPS));
      return sinc * window;
    });
  });

const INTERPOLATION_PHASES = buildInterpolationPhases();

/** Largest absolute sample value, linear. */
export const getSamplePeak = (channels: Float32Array[]) => {
  let peak = 0;
  for (const channel of channels) for (let index = 0; index < channel.length; index += 1) peak = Math.max(peak, Math.abs(channel[index]));
  return peak;
};

/** True peak in dBTP: the largest absolute value after 4x oversampling (-Infinity for silence). */
export const measureTruePeakDbtp = (channels: Float32Array[]) => {
  let peak = getSamplePeak(channels);
  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) {
      for (const phase of INTERPOLATION_PHASES) {
        let value = 0;
        for (let tap = 0; tap < phase.length; tap += 1) {
          const source = index + tap - SINC_HALF_TAPS + 1;
          if (source >= 0 && source < channel.length) value += channel[source] * phase[tap];
        }
        peak = Math.max(peak, Math.abs(value));
      }
    }
  }
  return peak > 0 ? 20 * Math.log10(peak) : Number.NEGATIVE_INFINITY;
};

export type LoudnessReading = { lufs: number; truePeakDbtp: number };

export const measureLoudness = (channels: Float32Array[], sampleRate: number): LoudnessReading => ({
  lufs: measureIntegratedLoudness(channels, sampleRate),
  truePeakDbtp: measureTruePeakDbtp(channels),
});

export type MasterReport = {
  before: LoudnessReading;
  after: LoudnessReading;
  gainDb: number;
  targetLufs: number;
  ceilingDbtp: number;
  /** True when the true-peak ceiling kept the mix quieter than the target. */
  limitedByPeak: boolean;
  /** True when the mix was silent (nothing to normalise). */
  silent: boolean;
};

/**
 * Gain that brings a reading to the target loudness without its true peak passing the ceiling.
 * Linear gain only, no limiter: the dynamics of the mix are left alone.
 */
export const computeMasterGainDb = (reading: LoudnessReading, targetLufs = TARGET_LUFS, ceilingDbtp = TRUE_PEAK_CEILING_DBTP) => {
  if (!Number.isFinite(reading.lufs)) return { gainDb: 0, limitedByPeak: false };
  const wanted = targetLufs - reading.lufs;
  const allowed = ceilingDbtp - reading.truePeakDbtp;
  return wanted > allowed ? { gainDb: allowed, limitedByPeak: true } : { gainDb: wanted, limitedByPeak: false };
};

/** Normalises the channels in place to -14 LUFS integrated, true peak at most -1 dBTP. */
export const normalizeToMaster = (channels: Float32Array[], sampleRate: number, targetLufs = TARGET_LUFS, ceilingDbtp = TRUE_PEAK_CEILING_DBTP): MasterReport => {
  const before = measureLoudness(channels, sampleRate);
  const silent = !Number.isFinite(before.lufs);
  const { gainDb, limitedByPeak } = computeMasterGainDb(before, targetLufs, ceilingDbtp);
  const gain = 10 ** (gainDb / 20);
  if (!silent) for (const channel of channels) for (let index = 0; index < channel.length; index += 1) channel[index] *= gain;
  const after = silent ? before : measureLoudness(channels, sampleRate);
  return { before, after, gainDb, targetLufs, ceilingDbtp, limitedByPeak, silent };
};
