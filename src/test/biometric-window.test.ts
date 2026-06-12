import { describe, expect, it } from "vitest";
import {
  computeBiometricWindow,
  computeTrackResponse,
  StateTracker,
  TriggerGate,
  type ReadingLike,
} from "../lib/biometric-window";

const T0 = 1_700_000_000_000;

function reading(offsetS: number, hr: number, extra: Partial<ReadingLike> = {}): ReadingLike {
  return { heartRate: hr, recordedAt: new Date(T0 + offsetS * 1000), ...extra };
}

describe("computeBiometricWindow", () => {
  it("returns null with fewer than two readings in the window", () => {
    const w = computeBiometricWindow([reading(0, 120)], {
      hrmaxEstimate: 180, restingHr: 60, timeInCurrentStateS: 0, previousState: null, now: T0,
    });
    expect(w).toBeNull();
  });

  it("computes HR mean and a positive trend for rising HR", () => {
    const readings = [reading(0, 100), reading(10, 110), reading(20, 120), reading(30, 130)];
    const w = computeBiometricWindow(readings, {
      hrmaxEstimate: 180, restingHr: 60, timeInCurrentStateS: 30, previousState: "OPTIMAL", now: T0 + 30_000,
    })!;
    expect(w.hr_mean).toBeCloseTo(115, 5);
    expect(w.hr_trend).toBeGreaterThan(0); // ~1 BPM/s
    expect(w.previous_state).toBe("OPTIMAL");
  });

  it("excludes readings older than the 30s window", () => {
    const readings = [reading(-40, 200), reading(0, 100), reading(10, 100)];
    const w = computeBiometricWindow(readings, {
      hrmaxEstimate: 180, restingHr: 60, timeInCurrentStateS: 0, previousState: null, now: T0 + 10_000,
    })!;
    expect(w.hr_mean).toBe(100); // the 200 BPM stale reading is dropped
  });

  it("leaves EEG relative powers null when no EEG present (HR-only)", () => {
    const readings = [reading(0, 120), reading(10, 122)];
    const w = computeBiometricWindow(readings, {
      hrmaxEstimate: 180, restingHr: 60, timeInCurrentStateS: 0, previousState: null, now: T0 + 10_000,
    })!;
    expect(w.eeg_alpha_rel).toBeNull();
    expect(w.eeg_beta_rel).toBeNull();
  });

  it("produces EEG relative band powers when EEG data is present", () => {
    const eeg = { eegAlpha: 8, eegBeta: 4, eegTheta: 4, eegGamma: 2, eegDelta: 2 };
    const readings = [reading(0, 90, eeg), reading(10, 92, eeg)];
    const w = computeBiometricWindow(readings, {
      hrmaxEstimate: 180, restingHr: 60, timeInCurrentStateS: 0, previousState: null, now: T0 + 10_000,
    })!;
    // alpha 8 of total 20 = 0.4
    expect(w.eeg_alpha_rel).toBeCloseTo(0.4, 5);
    expect(w.eeg_beta_rel).toBeCloseTo(0.2, 5);
  });
});

describe("StateTracker", () => {
  it("keeps OPTIMAL→FLOW family time continuous across the upgrade", () => {
    const t = new StateTracker();
    t.update("OPTIMAL", T0);
    // 9 minutes later still optimal family
    expect(t.optimalFamilySeconds(T0 + 540_000)).toBe(540);
    t.update("FLOW", T0 + 600_000);
    // family clock not reset by the OPTIMAL→FLOW transition
    expect(t.optimalFamilySeconds(T0 + 600_000)).toBe(600);
  });

  it("resets state clock and records previous distinct state on a real change", () => {
    const t = new StateTracker();
    t.update("OPTIMAL", T0);
    t.update("OVEREXERTING", T0 + 100_000);
    expect(t.previousState).toBe("OPTIMAL");
    expect(t.timeInStateS(T0 + 100_000)).toBe(0);
    // family time resets to zero when leaving the optimal family
    expect(t.optimalFamilySeconds(T0 + 100_000)).toBe(0);
  });
});

describe("TriggerGate", () => {
  it("does not fire on a single non-optimal tick (duration gating)", () => {
    const g = new TriggerGate({ ticksRequired: 3 });
    expect(g.evaluate("UNDERPERFORMING", false, T0).fire).toBe(false);
    expect(g.evaluate("UNDERPERFORMING", false, T0 + 5_000).fire).toBe(false);
  });

  it("fires once the required consecutive ticks are reached", () => {
    const g = new TriggerGate({ ticksRequired: 3, cooldownMs: 0 });
    g.evaluate("UNDERPERFORMING", false, T0);
    g.evaluate("UNDERPERFORMING", false, T0 + 5_000);
    expect(g.evaluate("UNDERPERFORMING", false, T0 + 10_000).fire).toBe(true);
  });

  it("an optimal tick resets the consecutive counter", () => {
    const g = new TriggerGate({ ticksRequired: 3, cooldownMs: 0 });
    g.evaluate("UNDERPERFORMING", false, T0);
    g.evaluate("UNDERPERFORMING", false, T0 + 5_000);
    g.evaluate("OPTIMAL", false, T0 + 10_000); // reset
    g.evaluate("UNDERPERFORMING", false, T0 + 15_000);
    expect(g.evaluate("UNDERPERFORMING", false, T0 + 20_000).fire).toBe(false);
  });

  it("requires a longer sustain while in flow-maintenance mode", () => {
    const g = new TriggerGate({ ticksRequired: 3, ticksRequiredInMaintenance: 6, cooldownMs: 0 });
    let fired = false;
    for (let i = 0; i < 4; i++) fired = g.evaluate("DISTRACTED", true, T0 + i * 5_000).fire || fired;
    expect(fired).toBe(false); // 4 ticks < 6 required in maintenance
  });

  it("flags HIGH urgency for overexertion and anxiety", () => {
    const g = new TriggerGate({ ticksRequired: 1, cooldownMs: 0 });
    expect(g.evaluate("OVEREXERTING", false, T0).urgency).toBe("HIGH");
    expect(g.evaluate("ANXIOUS", false, T0 + 5_000).urgency).toBe("HIGH");
    expect(g.evaluate("UNDERPERFORMING", false, T0 + 10_000).urgency).toBe("MEDIUM");
  });

  it("enforces a cooldown between fires", () => {
    const g = new TriggerGate({ ticksRequired: 1, cooldownMs: 60_000 });
    expect(g.evaluate("UNDERPERFORMING", false, T0).fire).toBe(true);
    // immediately eligible again by count, but cooled-down blocks it
    expect(g.evaluate("UNDERPERFORMING", false, T0 + 5_000).fire).toBe(false);
    expect(g.evaluate("UNDERPERFORMING", false, T0 + 61_000).fire).toBe(true);
  });
});

describe("computeTrackResponse", () => {
  it("returns the pre/post HR and focus deltas around track start", () => {
    const readings: ReadingLike[] = [
      reading(-20, 130, { focusScore: 50 }),
      reading(-10, 130, { focusScore: 50 }),
      reading(20, 120, { focusScore: 60 }),
      reading(40, 118, { focusScore: 62 }),
    ];
    const res = computeTrackResponse(readings, T0);
    expect(res.hr_delta).toBeCloseTo(119 - 130, 5); // post mean 119, pre mean 130
    expect(res.focus_delta).toBeCloseTo(61 - 50, 5);
  });

  it("returns nulls when either side of the window is empty", () => {
    const readings: ReadingLike[] = [reading(20, 120, { focusScore: 60 })];
    expect(computeTrackResponse(readings, T0)).toEqual({ hr_delta: null, focus_delta: null });
  });
});
