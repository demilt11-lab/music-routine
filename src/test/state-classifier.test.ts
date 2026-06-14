/**
 * State Classifier Unit Tests
 * Tests classifyBiometricState, validateBPMTransition, passesSpeechinessFilter
 */

import { describe, it, expect } from "vitest";
import {
  classifyBiometricState,
  validateBPMTransition,
  passesSpeechinessFilter,
  ACTIVITY_PROFILES,
  type BiometricWindow,
} from "@/lib/state-classifier";

// ── Fixture builders ─────────────────────────────────────────────────────────

function window(overrides: Partial<BiometricWindow> = {}): BiometricWindow {
  return {
    hr_mean: 140,
    hr_std: 3,
    hr_trend: 0,
    hrv_rmssd_mean: 55,
    hrmax_estimate: 190,
    resting_hr: 60,
    respiratory_rate_mean: null,
    eda_mean: null,
    stress_score_mean: 25,
    eeg_alpha_rel: 0.35,
    eeg_beta_rel: 0.25,
    eeg_theta_rel: 0.15,
    focus_score_mean: 75,
    calm_score_mean: null,
    activity_intensity_mean: null,
    steps_per_minute_mean: null,
    time_in_current_state_s: 700,
    previous_state: null,
    ...overrides,
  };
}

const cardio = ACTIVITY_PROFILES["cardio"];
const study  = ACTIVITY_PROFILES["study"];
const yoga   = ACTIVITY_PROFILES["yoga"];
const strength = ACTIVITY_PROFILES["strength_training"];

// ── FLOW state ───────────────────────────────────────────────────────────────
describe("classifyBiometricState — FLOW", () => {
  it("returns FLOW with high confidence when all conditions met", () => {
    const result = classifyBiometricState(
      window({ hr_mean: 130, hrmax_estimate: 190, hr_std: 2, time_in_current_state_s: 700 }),
      cardio,
    );
    expect(result.state).toBe("FLOW");
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("does NOT classify FLOW when sustained < 600s (10 min)", () => {
    const result = classifyBiometricState(
      window({ time_in_current_state_s: 599 }),
      cardio,
    );
    expect(result.state).not.toBe("FLOW");
  });

  it("does NOT classify FLOW when HRV < 40", () => {
    const result = classifyBiometricState(
      window({ hrv_rmssd_mean: 38, time_in_current_state_s: 700 }),
      cardio,
    );
    expect(result.state).not.toBe("FLOW");
  });

  it("FLOW is possible when HR data is null (null = no constraint on that signal)", () => {
    const result = classifyBiometricState(
      window({ hrv_rmssd_mean: null, focus_score_mean: null, eeg_alpha_rel: null, time_in_current_state_s: 700 }),
      cardio,
    );
    // null fields should not block FLOW classification
    expect(result.state).toBe("FLOW");
  });
});

// ── ANXIOUS state ────────────────────────────────────────────────────────────
describe("classifyBiometricState — ANXIOUS", () => {
  it("returns ANXIOUS when beta high + stress high + HR elevated + HRV drop", () => {
    const result = classifyBiometricState(
      window({
        eeg_beta_rel: 0.50,
        stress_score_mean: 75,  // cardio stress_max=70; 75>70 satisfies stressHigh
        hr_mean: 155,
        hrmax_estimate: 190,
        hrv_rmssd_mean: 22,
        time_in_current_state_s: 120,
      }),
      cardio,
    );
    expect(result.state).toBe("ANXIOUS");
    expect(result.confidence).toBeGreaterThanOrEqual(0.80);
  });

  it("does NOT return ANXIOUS when HRV is high despite other signals", () => {
    const result = classifyBiometricState(
      window({
        eeg_beta_rel: 0.50,
        stress_score_mean: 65,
        hr_mean: 155,
        hrmax_estimate: 190,
        hrv_rmssd_mean: 65,
        time_in_current_state_s: 120,
      }),
      cardio,
    );
    expect(result.state).not.toBe("ANXIOUS");
  });
});

// ── OVEREXERTING state ───────────────────────────────────────────────────────
describe("classifyBiometricState — OVEREXERTING", () => {
  it("returns OVEREXERTING when HR exceeds activity max %", () => {
    // cardio max = 88% of hrmax. 190 * 0.88 = 167.2 → HR 175 triggers it
    const result = classifyBiometricState(
      window({ hr_mean: 175, hrmax_estimate: 190, time_in_current_state_s: 120 }),
      cardio,
    );
    expect(result.state).toBe("OVEREXERTING");
  });

  it("does NOT return OVEREXERTING when HR is exactly at max threshold", () => {
    const threshold = Math.floor(190 * cardio.hr_max_pct); // 167
    const result = classifyBiometricState(
      window({ hr_mean: threshold, hrmax_estimate: 190 }),
      cardio,
    );
    expect(result.state).not.toBe("OVEREXERTING");
  });
});

// ── RECOVERING state ─────────────────────────────────────────────────────────
describe("classifyBiometricState — RECOVERING", () => {
  it("returns RECOVERING after OVEREXERTING when HR declining", () => {
    const result = classifyBiometricState(
      window({ hr_trend: -1.0, hr_mean: 115, hrmax_estimate: 190, previous_state: "OVEREXERTING" }),
      cardio,
    );
    expect(result.state).toBe("RECOVERING");
  });

  it("returns RECOVERING after FATIGUED when HR declining", () => {
    const result = classifyBiometricState(
      window({ hr_trend: -1.0, hr_mean: 115, hrmax_estimate: 190, previous_state: "FATIGUED" }),
      cardio,
    );
    expect(result.state).toBe("RECOVERING");
  });

  it("does NOT return RECOVERING when previous_state is OPTIMAL", () => {
    const result = classifyBiometricState(
      window({ hr_trend: -1.0, hr_mean: 115, hrmax_estimate: 190, previous_state: "OPTIMAL" }),
      cardio,
    );
    expect(result.state).not.toBe("RECOVERING");
  });
});

// ── DROWSY state ─────────────────────────────────────────────────────────────
describe("classifyBiometricState — DROWSY", () => {
  it("returns DROWSY when theta dominant + focus low + HR near resting", () => {
    const result = classifyBiometricState(
      window({
        eeg_theta_rel: 0.45,
        focus_score_mean: 30,
        hr_mean: 65,
        hrmax_estimate: 190,
        time_in_current_state_s: 60,
      }),
      study,
    );
    expect(result.state).toBe("DROWSY");
  });
});

// ── DISTRACTED state ─────────────────────────────────────────────────────────
describe("classifyBiometricState — DISTRACTED (study + creative)", () => {
  it("returns DISTRACTED for study activity with theta rising and focus falling", () => {
    const result = classifyBiometricState(
      window({ eeg_theta_rel: 0.35, focus_score_mean: 40, hr_mean: 75, hrmax_estimate: 190 }),
      study,
    );
    expect(result.state).toBe("DISTRACTED");
  });

  it("returns DISTRACTED for creative_work activity", () => {
    const creative = ACTIVITY_PROFILES["creative_work"];
    const result = classifyBiometricState(
      window({ eeg_theta_rel: 0.35, focus_score_mean: 40, hr_mean: 75, hrmax_estimate: 190 }),
      creative,
    );
    expect(result.state).toBe("DISTRACTED");
  });

  it("does NOT return DISTRACTED for cardio activity (theta + focus irrelevant)", () => {
    const result = classifyBiometricState(
      window({ eeg_theta_rel: 0.35, focus_score_mean: 40, hr_mean: 130, hrmax_estimate: 190 }),
      cardio,
    );
    expect(result.state).not.toBe("DISTRACTED");
  });
});

// ── FATIGUED state ───────────────────────────────────────────────────────────
describe("classifyBiometricState — FATIGUED", () => {
  it("returns FATIGUED with declining HR, low intensity, HRV drop", () => {
    const result = classifyBiometricState(
      window({
        hr_trend: -0.8,
        activity_intensity_mean: 2,
        hrv_rmssd_mean: 20,
        hr_mean: 120,
        hrmax_estimate: 190,
        previous_state: "OPTIMAL",
      }),
      cardio,
    );
    expect(result.state).toBe("FATIGUED");
  });
});

// ── UNDERPERFORMING state ────────────────────────────────────────────────────
describe("classifyBiometricState — UNDERPERFORMING", () => {
  it("returns UNDERPERFORMING when HR below activity floor", () => {
    // strength floor = 70% of hrmax. 190 * 0.70 = 133. HR 100 triggers it.
    const result = classifyBiometricState(
      window({ hr_mean: 100, hrmax_estimate: 190 }),
      strength,
    );
    expect(result.state).toBe("UNDERPERFORMING");
  });
});

// ── OPTIMAL (default) ────────────────────────────────────────────────────────
describe("classifyBiometricState — OPTIMAL", () => {
  it("returns OPTIMAL at high confidence when HR stable in range", () => {
    // cardio optimal = 65-80%. 190 * 0.72 = 136.8
    const result = classifyBiometricState(
      window({ hr_mean: 137, hr_std: 2, hrmax_estimate: 190, time_in_current_state_s: 120 }),
      cardio,
    );
    expect(result.state).toBe("OPTIMAL");
    expect(result.confidence).toBeGreaterThanOrEqual(0.80);
  });

  it("returns OPTIMAL at lower confidence when HR not stable", () => {
    const result = classifyBiometricState(
      window({ hr_mean: 137, hr_std: 10, hrmax_estimate: 190, time_in_current_state_s: 120 }),
      cardio,
    );
    expect(result.state).toBe("OPTIMAL");
    expect(result.confidence).toBeLessThan(0.80);
  });
});

// ── Guard: hrmax_estimate = 0 (division by zero) ─────────────────────────────
describe("classifyBiometricState — guard: hrmax_estimate = 0", () => {
  it("does NOT produce NaN state when hrmax_estimate is 0", () => {
    const result = classifyBiometricState(
      window({ hr_mean: 75, hrmax_estimate: 0 }),
      cardio,
    );
    expect(result.state).toBeDefined();
    expect(typeof result.state).toBe("string");
    expect(result.confidence).not.toBeNaN();
  });
});

// ── Guard: missing/NaN biometric values ──────────────────────────────────────
describe("classifyBiometricState — guard: NaN inputs", () => {
  it("handles NaN hr_mean without producing NaN state", () => {
    const result = classifyBiometricState(
      window({ hr_mean: NaN, hrmax_estimate: 190 }),
      cardio,
    );
    expect(result.state).toBeDefined();
    expect(result.confidence).not.toBeNaN();
  });
});

// ── validateBPMTransition ─────────────────────────────────────────────────────
describe("validateBPMTransition", () => {
  it("allows transition within 30 BPM (MEDIUM urgency)", () => {
    expect(validateBPMTransition(120, 145, "MEDIUM").allowed).toBe(true);
  });

  it("rejects transition > 30 BPM on MEDIUM urgency", () => {
    const result = validateBPMTransition(100, 135, "MEDIUM");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/35|exceeds|limit/i);
  });

  it("allows transition up to 60 BPM on HIGH urgency", () => {
    expect(validateBPMTransition(80, 135, "HIGH").allowed).toBe(true);
  });

  it("rejects transition > 60 BPM on HIGH urgency", () => {
    expect(validateBPMTransition(60, 125, "HIGH").allowed).toBe(false);
  });

  it("accepts identical BPM (delta = 0)", () => {
    expect(validateBPMTransition(120, 120).allowed).toBe(true);
  });

  it("works bidirectionally (downward tempo shift)", () => {
    expect(validateBPMTransition(160, 135, "MEDIUM").allowed).toBe(true);   // delta=25
    expect(validateBPMTransition(160, 115, "MEDIUM").allowed).toBe(false);  // delta=45
  });
});

// ── passesSpeechinessFilter ───────────────────────────────────────────────────
describe("passesSpeechinessFilter", () => {
  it("blocks speechy track (0.6) for study activity", () => {
    expect(passesSpeechinessFilter(0.6, "study")).toBe(false);
  });

  it("allows low-speechiness track (0.2) for study", () => {
    expect(passesSpeechinessFilter(0.2, "study")).toBe(true);
  });

  it("boundary: 0.3 speechiness is allowed for study (≤ 0.3)", () => {
    expect(passesSpeechinessFilter(0.3, "study")).toBe(true);
  });

  it("boundary: 0.31 speechiness is blocked for study", () => {
    expect(passesSpeechinessFilter(0.31, "study")).toBe(false);
  });

  it("allows any speechiness for cardio (not a strict activity)", () => {
    expect(passesSpeechinessFilter(0.9, "cardio")).toBe(true);
  });

  it("user override bypasses filter even for study", () => {
    expect(passesSpeechinessFilter(0.8, "study", true)).toBe(true);
  });

  it("null speechiness is treated as allowed (unknown = no block)", () => {
    expect(passesSpeechinessFilter(null, "study")).toBe(true);
  });

  it("blocks speechy track for meditation", () => {
    expect(passesSpeechinessFilter(0.5, "meditation")).toBe(false);
  });

  it("blocks speechy track for sleep", () => {
    expect(passesSpeechinessFilter(0.4, "sleep")).toBe(false);
  });
});

// ── ACTIVITY_PROFILES completeness ───────────────────────────────────────────
describe("ACTIVITY_PROFILES", () => {
  const required = ["strength_training", "cardio", "yoga", "study", "meditation", "creative_work", "recovery", "sleep"];

  it.each(required)("profile '%s' exists", (name) => {
    expect(ACTIVITY_PROFILES[name]).toBeDefined();
  });

  it.each(required)("profile '%s' has valid hr % bounds (0-1)", (name) => {
    const p = ACTIVITY_PROFILES[name];
    expect(p.hr_min_pct).toBeGreaterThanOrEqual(0);
    expect(p.hr_max_pct).toBeLessThanOrEqual(1);
    expect(p.hr_optimal_min_pct).toBeLessThanOrEqual(p.hr_optimal_max_pct);
  });
});
