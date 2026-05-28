import type { EegBands } from "@biomusic/core";

/**
 * Pure EEG signal-processing helpers, separated from the Bluetooth transport so
 * they can be unit-tested without hardware. Band powers are estimated with the
 * Goertzel algorithm (cheaper than a full FFT when we only need a handful of
 * frequency bins) over a Hann-windowed sample buffer.
 */

export const EEG_SAMPLE_RATE = 256; // Hz (Muse)

const BAND_FREQS: Record<keyof EegBands, number[]> = {
  delta: [1, 2, 3],
  theta: [4, 5, 6, 7],
  alpha: [8, 9, 10, 11, 12],
  beta: range(13, 30),
  gamma: range(31, 44),
};

/** Decode Muse's packed unsigned 12-bit samples (3 bytes → 2 samples). */
export function decodeUnsigned12Bit(bytes: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i + 2 < bytes.length; i += 3) {
    out.push((bytes[i] << 4) | (bytes[i + 1] >> 4));
    out.push(((bytes[i + 1] & 0x0f) << 8) | bytes[i + 2]);
  }
  return out;
}

/** Convert a raw 12-bit Muse sample to microvolts. */
export function rawToMicrovolts(raw: number): number {
  return 0.48828125 * (raw - 0x800);
}

// Hann windows are identical for a given length, so build each once and reuse
// across every band, frequency, and emit — instead of recomputing a cos() per
// sample per frequency.
const hannWindows = new Map<number, Float64Array>();
function hannWindow(length: number): Float64Array {
  let w = hannWindows.get(length);
  if (!w) {
    w = new Float64Array(length);
    for (let i = 0; i < length; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
    hannWindows.set(length, w);
  }
  return w;
}

/** Power at a single frequency via the Goertzel algorithm (no windowing). */
export function goertzelPower(samples: ArrayLike<number>, freq: number, sampleRate: number): number {
  const n = samples.length;
  if (n === 0) return 0;
  const k = Math.round((n * freq) / sampleRate);
  const coeff = 2 * Math.cos((2 * Math.PI * k) / n);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    const s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return (s1 * s1 + s2 * s2 - coeff * s1 * s2) / n;
}

/** Estimate average band powers (µV²) across the sample window. */
export function bandPowers(samples: number[], sampleRate = EEG_SAMPLE_RATE): EegBands {
  // Apply the (cached) Hann window once, then run Goertzel over the result.
  const win = hannWindow(samples.length);
  const windowed = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) windowed[i] = samples[i] * win[i];

  const power = (freqs: number[]) => {
    let sum = 0;
    for (const f of freqs) sum += goertzelPower(windowed, f, sampleRate);
    return sum / freqs.length;
  };
  return {
    delta: power(BAND_FREQS.delta),
    theta: power(BAND_FREQS.theta),
    alpha: power(BAND_FREQS.alpha),
    beta: power(BAND_FREQS.beta),
    gamma: power(BAND_FREQS.gamma),
  };
}

/**
 * Map band powers to the 0–100 cognitive scores the rest of the app consumes.
 * Heuristics: alpha+theta dominance → relaxed/meditative; beta over the slower
 * bands → focused.
 */
export function scoresFromBands(bands: EegBands): {
  focusScore: number;
  relaxationScore: number;
  meditationScore: number;
} {
  const total = bands.delta + bands.theta + bands.alpha + bands.beta + bands.gamma || 1;
  const rel = {
    theta: bands.theta / total,
    alpha: bands.alpha / total,
    beta: bands.beta / total,
  };
  const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
  return {
    relaxationScore: clamp((rel.alpha + rel.theta) * 150),
    focusScore: clamp((rel.beta / (rel.theta + rel.alpha + 1e-6)) * 70),
    meditationScore: clamp(rel.theta * 220),
  };
}

function range(lo: number, hi: number): number[] {
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}
