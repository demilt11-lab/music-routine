/**
 * Phase 2.1 — Biometric Ingestion Unit Tests
 *
 * QA Requirements:
 *  - HR = 0        → invalid, not passed to classifier
 *  - HR = 300      → out-of-range artifact, not passed
 *  - HRV = -1      → rejected, logged, session continues
 *  - SpO2 < 70     → artifact flag (NOT medical alert)
 *  - EEG bands ≠ ~1.0 → artifact flag
 *  - 10 consecutive null ticks → data_gap event
 *  - 30 consecutive null ticks → fallback mode on last valid
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBiometricTracking } from "../useBiometricTracking";

// ── helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal valid reading, overrideable per test. */
function reading(overrides: Partial<Parameters<ReturnType<typeof useBiometricTracking>["addReading"]>[0]> = {}) {
  return {
    heartRate: 75,
    heartRateVariability: 55,
    stressLevel: 25,
    relaxationScore: 65,
    focusScore: 70,
    deviceType: "apple_watch",
    confidence: "high" as const,
    signalQuality: 90,
    ...overrides,
  };
}

// ── 2.1.1 HR = 0 ────────────────────────────────────────────────────────────
describe("HR validation — value 0", () => {
  it("rejects HR=0 and does not advance the reading count", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ heartRate: 0 })));
    expect(result.current.state.readings).toHaveLength(0);
  });

  it("emits a console.warn for HR=0", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ heartRate: 0 })));
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/rejected|out-of-range|invalid/i),
      0,
    );
  });

  it("session continues after HR=0 rejection (subsequent valid reading accepted)", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ heartRate: 0 })));
    act(() => result.current.addReading(reading({ heartRate: 72 })));
    expect(result.current.state.readings).toHaveLength(1);
    expect(result.current.state.currentReading?.heartRate).toBe(72);
  });
});

// ── 2.1.2 HR = 300 ──────────────────────────────────────────────────────────
describe("HR validation — value 300 (out-of-range artifact)", () => {
  it("rejects HR=300", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ heartRate: 300 })));
    expect(result.current.state.readings).toHaveLength(0);
  });

  it("emits a console.warn for HR=300", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ heartRate: 300 })));
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/rejected|out-of-range|invalid/i),
      300,
    );
  });

  it("HR=300 does not affect running averages", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ heartRate: 70 })));
    const avgBefore = result.current.state.averages.heartRate;
    act(() => result.current.addReading(reading({ heartRate: 300 })));
    expect(result.current.state.averages.heartRate).toBe(avgBefore);
  });

  it("values just below upper limit (210) are accepted", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ heartRate: 210 })));
    expect(result.current.state.readings).toHaveLength(1);
  });

  it("values just above upper limit (211) are rejected", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ heartRate: 211 })));
    expect(result.current.state.readings).toHaveLength(0);
  });
});

// ── 2.1.3 HRV = -1 ──────────────────────────────────────────────────────────
describe("HRV validation — negative value (-1)", () => {
  it("rejects HRV=-1 — not stored", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ heartRateVariability: -1 })));
    expect(result.current.state.readings).toHaveLength(0);
  });

  it("emits console.warn for negative HRV", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ heartRateVariability: -1 })));
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/hrv|variability|invalid|rejected/i),
      expect.anything(),
    );
  });

  it("session continues after HRV=-1 rejection", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ heartRateVariability: -1 })));
    act(() => result.current.addReading(reading({ heartRateVariability: 45 })));
    expect(result.current.state.readings).toHaveLength(1);
  });

  it("HRV=0 is also rejected (non-physiological)", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ heartRateVariability: 0 })));
    expect(result.current.state.readings).toHaveLength(0);
  });

  it("HRV=1 (minimum valid) is accepted", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ heartRateVariability: 1 })));
    expect(result.current.state.readings).toHaveLength(1);
  });
});

// ── 2.1.4 SpO2 < 70 ─────────────────────────────────────────────────────────
describe("SpO2 validation — artifact detection (not medical alert)", () => {
  it("flags SpO2 < 70 as artifact without rejecting the reading", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ bloodOxygen: 65 } as any)));
    // Reading is stored but marked as low-confidence artifact
    const stored = result.current.state.readings[0];
    expect(stored).toBeDefined();
    expect(stored.confidence).toMatch(/low|artifact/);
  });

  it("SpO2 < 70 does NOT throw a medical alert / diagnosis string", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ bloodOxygen: 60 } as any)));
    // No medical alert language in any warn/error call
    const warnCalls = (console.warn as ReturnType<typeof vi.fn>).mock.calls.flat().join(" ");
    const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat().join(" ");
    const combined = (warnCalls + " " + errorCalls).toLowerCase();
    expect(combined).not.toMatch(/hypoxia|emergency|call\s+doctor|medical\s+alert|danger/);
  });

  it("SpO2 between 70-100 is accepted at normal confidence", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ bloodOxygen: 97 } as any)));
    expect(result.current.state.readings).toHaveLength(1);
    expect(result.current.state.readings[0].confidence).not.toMatch(/artifact/);
  });

  it("SpO2 > 100 (impossible value) is also flagged as artifact", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ bloodOxygen: 105 } as any)));
    const stored = result.current.state.readings[0];
    if (stored) {
      expect(stored.confidence).toMatch(/low|artifact/);
    } else {
      // acceptable alternative: rejected entirely
      expect(result.current.state.readings).toHaveLength(0);
    }
  });
});

// ── 2.1.5 EEG band powers don't sum to ~1.0 ─────────────────────────────────
describe("EEG band power validation — sum constraint", () => {
  it("flags EEG bands that sum to >> 1.0 as artifact", () => {
    const { result } = renderHook(() => useBiometricTracking());
    // These are absolute powers, not normalized — should trigger artifact flag
    act(() => result.current.addReading(reading({
      eegAlpha: 20,
      eegBeta: 30,
      eegTheta: 15,
      eegGamma: 40,
      eegDelta: 10,
    })));
    const stored = result.current.state.readings[0];
    if (stored) {
      expect(stored.confidence).toMatch(/low|artifact/);
    } else {
      expect(result.current.state.readings).toHaveLength(0);
    }
  });

  it("EEG bands summing to ~1.0 (relative powers) are accepted at normal confidence", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({
      eegAlpha: 0.35,
      eegBeta: 0.25,
      eegTheta: 0.20,
      eegGamma: 0.10,
      eegDelta: 0.10,
    })));
    expect(result.current.state.readings).toHaveLength(1);
    expect(result.current.state.readings[0].confidence).not.toMatch(/artifact/);
  });

  it("all-zero EEG (sensor disconnected) is flagged as artifact", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({
      eegAlpha: 0,
      eegBeta: 0,
      eegTheta: 0,
      eegGamma: 0,
      eegDelta: 0,
    })));
    const stored = result.current.state.readings[0];
    if (stored) {
      expect(stored.confidence).toMatch(/low|artifact/);
    } else {
      expect(result.current.state.readings).toHaveLength(0);
    }
  });
});

// ── 2.1.6 10 consecutive null ticks → data_gap event ────────────────────────
describe("Null tick handling — 10 consecutive nulls", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires a data_gap event after 10 consecutive null ticks", () => {
    const { result } = renderHook(() => useBiometricTracking());

    // Start with one valid reading so there IS a last-known state
    act(() => result.current.addReading(reading()));
    act(() => result.current.startTracking("session-null-test"));

    // Advance 10 × 2s intervals with no addReading calls (nulls)
    act(() => vi.advanceTimersByTime(20_000));

    expect(result.current.state.dataGap).toBe(true);
    act(() => result.current.stopTracking());
  });

  it("data_gap resets when a valid reading arrives", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.startTracking("session-gap-reset"));
    act(() => vi.advanceTimersByTime(20_000)); // trigger gap
    act(() => result.current.addReading(reading()));
    expect(result.current.state.dataGap).toBe(false);
    act(() => result.current.stopTracking());
  });
});

// ── 2.1.7 30 consecutive null ticks → fallback mode ──────────────────────────
describe("Null tick handling — 30 consecutive nulls → fallback mode", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("activates fallback mode after 30 null ticks", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ heartRate: 68, focusScore: 72 })));
    act(() => result.current.startTracking("session-fallback-test"));

    // 30 × 2s = 60 seconds of silence
    act(() => vi.advanceTimersByTime(60_000));

    expect(result.current.state.fallbackMode).toBe(true);
    act(() => result.current.stopTracking());
  });

  it("classifier in fallback mode runs on last valid reading (not defaults)", () => {
    const { result } = renderHook(() => useBiometricTracking());

    // Start the session first, then send a real reading partway in
    act(() => result.current.startTracking("session-last-valid"));

    const lastValidHR = 82;
    act(() => result.current.addReading(reading({ heartRate: lastValidHR, deviceType: "apple_watch" })));

    // Now advance 60s of silence — 30 ticks with no real device reading
    act(() => vi.advanceTimersByTime(60_000));

    // The current reading should reflect the last known real device HR
    const current = result.current.state.currentReading;
    expect(current?.heartRate).toBe(lastValidHR);
    expect(result.current.state.fallbackMode).toBe(true);
    act(() => result.current.stopTracking());
  });

  it("fallback mode is marked as low-confidence, not simulated", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading()));
    act(() => result.current.startTracking("session-fallback-confidence"));
    act(() => vi.advanceTimersByTime(60_000));

    const current = result.current.state.currentReading;
    expect(current?.confidence).toMatch(/low|fallback/);
    // Must NOT claim it is simulated — we have real last-known data
    expect(current?.confidence).not.toBe("simulated");
    act(() => result.current.stopTracking());
  });
});

// ── 2.1.8 Boundary values ────────────────────────────────────────────────────
describe("HR boundary values", () => {
  const cases: [number, boolean][] = [
    [0,   false],
    [34,  false],
    [35,  true],
    [72,  true],
    [210, true],
    [211, false],
    [300, false],
  ];

  it.each(cases)("HR=%i → accepted=%s", (hr, accepted) => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.addReading(reading({ heartRate: hr })));
    expect(result.current.state.readings.length > 0).toBe(accepted);
  });
});

// ── 2.1.9 Simulated data marked correctly ────────────────────────────────────
describe("Simulated readings", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("simulated readings are marked with confidence=simulated", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.simulateBiometrics(0.5, 120));
    expect(result.current.state.readings[0].confidence).toBe("simulated");
    expect(result.current.state.readings[0].deviceType).toBe("simulated");
  });

  it("sessionSource is 'real' once a real reading is added", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.simulateBiometrics());
    act(() => result.current.addReading(reading({ deviceType: "apple_watch" })));
    expect(result.current.state.sessionSource).toBe("real");
  });

  it("sessionSource stays 'simulated' when only simulated readings exist", () => {
    const { result } = renderHook(() => useBiometricTracking());
    act(() => result.current.simulateBiometrics());
    expect(result.current.state.sessionSource).toBe("simulated");
  });
});

// ── 2.1.10 Baseline computation ──────────────────────────────────────────────
describe("Session baseline (first 15 readings)", () => {
  it("baseline is null before 15 readings", () => {
    const { result } = renderHook(() => useBiometricTracking());
    for (let i = 0; i < 14; i++) {
      act(() => result.current.addReading(reading()));
    }
    expect(result.current.state.sessionBaseline).toBeNull();
  });

  it("baseline is computed at exactly 15 readings", () => {
    const { result } = renderHook(() => useBiometricTracking());
    for (let i = 0; i < 15; i++) {
      act(() => result.current.addReading(reading({ focusScore: 70, relaxationScore: 60, stressLevel: 30 })));
    }
    expect(result.current.state.sessionBaseline).not.toBeNull();
    expect(result.current.state.sessionBaseline?.focus).toBeCloseTo(70, 0);
  });

  it("baseline does not change after it is set", () => {
    const { result } = renderHook(() => useBiometricTracking());
    for (let i = 0; i < 15; i++) {
      act(() => result.current.addReading(reading({ focusScore: 70 })));
    }
    const baseline = result.current.state.sessionBaseline;
    // Add more readings with very different values
    for (let i = 0; i < 5; i++) {
      act(() => result.current.addReading(reading({ focusScore: 10 })));
    }
    expect(result.current.state.sessionBaseline?.focus).toBe(baseline?.focus);
  });
});
