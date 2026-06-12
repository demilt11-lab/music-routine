import { describe, expect, it } from "vitest";
import {
  blendDelta,
  blendProfiles,
  personalModelWeight,
  pickTransitionSequence,
} from "../../supabase/functions/_shared/selection";

describe("personalModelWeight (spec Module 7)", () => {
  it("is zero before the 5-session activation threshold", () => {
    expect(personalModelWeight(0)).toBe(0);
    expect(personalModelWeight(4)).toBe(0);
  });

  it("grows with session count from activation", () => {
    expect(personalModelWeight(5)).toBeCloseTo(0.25, 5);
    expect(personalModelWeight(10)).toBeCloseTo(0.5, 5);
  });

  it("caps at 0.85 (population floor 0.15)", () => {
    expect(personalModelWeight(17)).toBeCloseTo(0.85, 5);
    expect(personalModelWeight(100)).toBeCloseTo(0.85, 5);
  });
});

describe("blendDelta", () => {
  it("weights personal vs population", () => {
    expect(blendDelta(10, 0, 0.85)).toBeCloseTo(8.5, 5);
    expect(blendDelta(10, -10, 0.5)).toBeCloseTo(0, 5);
  });

  it("falls back to whichever side has data", () => {
    expect(blendDelta(null, 7, 0.85)).toBe(7);
    expect(blendDelta(4, null, 0.85)).toBe(4);
    expect(blendDelta(null, null, 0.85)).toBeNull();
  });
});

describe("blendProfiles", () => {
  it("uses population only below the activation threshold", () => {
    const out = blendProfiles(
      { avg_hr_delta_60s: 100, avg_focus_delta_60s: 100, avg_stress_delta_60s: 100 },
      { avg_hr_delta_60s: 0, avg_focus_delta_60s: 0, avg_stress_delta_60s: 0 },
      3, // < 5 sessions → personal weight 0
    );
    expect(out.avg_hr_delta_60s).toBeCloseTo(0, 5);
  });
});

describe("pickTransitionSequence (≤15 BPM steps toward target)", () => {
  const candidates = [
    { id: "a", tempo: 125, score: 5 },
    { id: "b", tempo: 138, score: 9 },
    { id: "c", tempo: 150, score: 7 },
    { id: "d", tempo: 95, score: 10 }, // moves away from target
    { id: "e", tempo: 180, score: 10 }, // jump too big from 110
  ];

  it("builds a ramp from lead BPM toward the target midpoint", () => {
    const seq = pickTransitionSequence(candidates, 110, 140, 160, { maxStepBpm: 15, length: 2 });
    expect(seq.map((s) => s.id)).toEqual(["a", "b"]); // 110→125→138
  });

  it("never steps more than maxStepBpm per hop", () => {
    const seq = pickTransitionSequence(candidates, 110, 140, 160, { maxStepBpm: 15, length: 3 });
    let prev = 110;
    for (const s of seq) {
      expect(Math.abs(s.tempo! - prev)).toBeLessThanOrEqual(15);
      prev = s.tempo!;
    }
  });

  it("never moves away from the target", () => {
    const seq = pickTransitionSequence(candidates, 110, 140, 160, { maxStepBpm: 30, length: 3 });
    expect(seq.find((s) => s.id === "d")).toBeUndefined();
  });

  it("returns empty when nothing is reachable", () => {
    const seq = pickTransitionSequence(
      [{ id: "x", tempo: 200, score: 1 }],
      110, 140, 160,
      { maxStepBpm: 15, length: 2 },
    );
    expect(seq).toEqual([]);
  });

  it("does not reuse a song within the sequence", () => {
    const seq = pickTransitionSequence(
      [{ id: "a", tempo: 120, score: 5 }],
      110, 118, 122,
      { maxStepBpm: 15, length: 3 },
    );
    expect(seq.map((s) => s.id)).toEqual(["a"]);
  });
});
