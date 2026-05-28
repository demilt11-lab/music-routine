import { describe, expect, it } from "vitest";
import { bandPowers, decodeUnsigned12Bit, rawToMicrovolts, scoresFromBands } from "./eeg-dsp";

function sine(freq: number, n = 256, sampleRate = 256, amp = 50): number[] {
  return Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / sampleRate));
}

describe("eeg-dsp", () => {
  it("decodes packed 12-bit samples (3 bytes → 2 samples)", () => {
    // 0xABC, 0xDEF packed big-endian into [0xAB, 0xCD, 0xEF]
    expect(decodeUnsigned12Bit(new Uint8Array([0xab, 0xcd, 0xef]))).toEqual([0xabc, 0xdef]);
  });

  it("centres raw samples around zero microvolts", () => {
    expect(rawToMicrovolts(0x800)).toBe(0);
    expect(rawToMicrovolts(0x801)).toBeGreaterThan(0);
  });

  it("attributes a 10 Hz signal to the alpha band", () => {
    const b = bandPowers(sine(10));
    expect(b.alpha).toBeGreaterThan(b.delta);
    expect(b.alpha).toBeGreaterThan(b.theta);
    expect(b.alpha).toBeGreaterThan(b.beta);
    expect(b.alpha).toBeGreaterThan(b.gamma);
  });

  it("attributes a 20 Hz signal to the beta band", () => {
    const b = bandPowers(sine(20));
    expect(b.beta).toBeGreaterThan(b.alpha);
    expect(b.beta).toBeGreaterThan(b.theta);
  });

  it("rates a strong alpha signal as relaxed", () => {
    const scores = scoresFromBands(bandPowers(sine(10)));
    expect(scores.relaxationScore).toBeGreaterThan(scores.focusScore);
  });
});
