import { describe, expect, it } from "vitest";
import { recommend } from "./adaptive-engine.js";
import { derivePreferences } from "./preferences.js";
import { ACTIVITY_TARGETS } from "./activity-targets.js";
import type { BiometricSample } from "./types.js";

const now = () => new Date().toISOString();
const sample = (over: Partial<BiometricSample> = {}): BiometricSample => ({ recordedAt: now(), ...over });

describe("adaptive engine", () => {
  it("slows tempo when heart rate exceeds the workout ceiling", () => {
    const rec = recommend({ activity: "workout", sample: sample({ heartRate: 185, stressLevel: 70 }) });
    expect(rec.action).toBe("decrease_tempo");
    expect(rec.targetTempo).toBeLessThanOrEqual(ACTIVITY_TARGETS.workout.tempo.max);
    expect(rec.targetTempo).toBeGreaterThanOrEqual(ACTIVITY_TARGETS.workout.tempo.min);
  });

  it("raises tempo when heart rate is below the workout floor", () => {
    const rec = recommend({ activity: "workout", sample: sample({ heartRate: 90 }) });
    expect(rec.action).toBe("increase_tempo");
  });

  it("reduces energy when study stress is too high", () => {
    const rec = recommend({ activity: "study", sample: sample({ stressLevel: 80, focusScore: 40 }) });
    expect(rec.action).toBe("decrease_energy");
    expect(rec.targetEnergy).toBeLessThanOrEqual(ACTIVITY_TARGETS.study.energy.max);
  });

  it("maintains when the user is solidly in flow", () => {
    const history = Array.from({ length: 6 }, () => sample({ focusScore: 85, stressLevel: 15, heartRate: 70 }));
    const rec = recommend({
      activity: "study",
      sample: sample({ focusScore: 88, stressLevel: 12, heartRate: 70 }),
      history,
    });
    expect(rec.action).toBe("maintain");
  });

  it("always returns targets inside the activity envelope", () => {
    for (const activity of ["workout", "study", "sleep", "relax", "commute", "meditation"] as const) {
      const t = ACTIVITY_TARGETS[activity];
      const rec = recommend({ activity, sample: sample({ heartRate: 200, stressLevel: 95, focusScore: 5 }) });
      expect(rec.targetTempo).toBeGreaterThanOrEqual(t.tempo.min);
      expect(rec.targetTempo).toBeLessThanOrEqual(t.tempo.max);
      expect(rec.targetEnergy).toBeGreaterThanOrEqual(t.energy.min);
      expect(rec.targetEnergy).toBeLessThanOrEqual(t.energy.max);
      expect(rec.confidence).toBeGreaterThan(0);
      expect(rec.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("never seeds disliked artists and prefers liked ones", () => {
    const prefs = derivePreferences([
      { trackArtist: "Noisy Band", feedback: "down" },
      { trackArtist: "Noisy Band", feedback: "down" },
      { trackArtist: "Calm Duo", feedback: "up" },
      { trackArtist: "Calm Duo", feedback: "up" },
    ]);
    const rec = recommend({ activity: "relax", sample: sample({ heartRate: 70 }), preferences: prefs });
    expect(rec.seeds.avoidArtists).toContain("noisy band");
    expect(rec.seeds.preferArtists).toContain("calm duo");
  });

  it("confidence grows with more signals and history", () => {
    const sparse = recommend({ activity: "study", sample: sample({ heartRate: 70 }) });
    const rich = recommend({
      activity: "study",
      sample: sample({ heartRate: 70, hrv: 60, stressLevel: 20, focusScore: 80, eeg: { alpha: 10, beta: 5, theta: 4, gamma: 2, delta: 1 } }),
      history: Array.from({ length: 10 }, () => sample({ heartRate: 70, focusScore: 80, stressLevel: 20 })),
    });
    expect(rich.confidence).toBeGreaterThan(sparse.confidence);
  });
});
