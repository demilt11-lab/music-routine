import { describe, expect, it } from "vitest";
import {
  ACTIVITY_PROFILES,
  classifyBiometricState,
  passesSpeechinessFilter,
  resolveActivityProfile,
  validateBPMTransition,
  type BiometricWindow,
} from "../../supabase/functions/_shared/classifier";

// A neutral baseline window; individual tests override the signals that
// drive the state under test. hrmax 180 ≈ a 40-year-old (220 - 40).
function makeWindow(overrides: Partial<BiometricWindow> = {}): BiometricWindow {
  return {
    hr_mean: 130,
    hr_std: 3,
    hr_trend: 0,
    hrv_rmssd_mean: 50,
    hrmax_estimate: 180,
    resting_hr: 60,
    respiratory_rate_mean: 14,
    eda_mean: null,
    stress_score_mean: 30,
    eeg_alpha_rel: null,
    eeg_beta_rel: null,
    eeg_theta_rel: null,
    focus_score_mean: null,
    calm_score_mean: null,
    activity_intensity_mean: 5,
    steps_per_minute_mean: null,
    time_in_current_state_s: 60,
    previous_state: null,
    ...overrides,
  };
}

describe("classifyBiometricState — all 9 state classes", () => {
  const strength = ACTIVITY_PROFILES.strength_training;
  const cardio = ACTIVITY_PROFILES.cardio;
  const study = ACTIVITY_PROFILES.study;

  it("FLOW: optimal HR, stable, low stress, sustained 10+ min", () => {
    const result = classifyBiometricState(
      makeWindow({
        hr_mean: 140, // 78% of 180 — inside strength optimal 75-82%
        hr_std: 3,
        focus_score_mean: 80,
        eeg_alpha_rel: 0.4,
        stress_score_mean: 30,
        hrv_rmssd_mean: 55,
        time_in_current_state_s: 700,
        previous_state: "OPTIMAL",
      }),
      strength,
    );
    expect(result.state).toBe("FLOW");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.transition_from).toBe("OPTIMAL");
  });

  it("ANXIOUS: elevated beta + high stress + elevated HR + HRV drop", () => {
    const result = classifyBiometricState(
      makeWindow({
        hr_mean: 144, // 80% — elevated
        eeg_beta_rel: 0.5,
        stress_score_mean: 80,
        hrv_rmssd_mean: 25,
        time_in_current_state_s: 100, // not sustained → not FLOW
      }),
      strength,
    );
    expect(result.state).toBe("ANXIOUS");
  });

  it("OVEREXERTING: HR above the activity's safe ceiling", () => {
    const result = classifyBiometricState(
      makeWindow({ hr_mean: 170, stress_score_mean: null }), // 94% > 90% max
      strength,
    );
    expect(result.state).toBe("OVEREXERTING");
  });

  it("RECOVERING: HR declining after OVEREXERTING", () => {
    const result = classifyBiometricState(
      makeWindow({
        hr_mean: 117, // 65% — above 55% floor, below ceilings
        hr_trend: -1,
        previous_state: "OVEREXERTING",
      }),
      cardio,
    );
    expect(result.state).toBe("RECOVERING");
    expect(result.transition_from).toBe("OVEREXERTING");
  });

  it("DROWSY: theta dominant, focus collapsed, HR near resting", () => {
    const result = classifyBiometricState(
      makeWindow({
        hr_mean: 90, // 50%
        eeg_theta_rel: 0.5,
        focus_score_mean: 30,
      }),
      study,
    );
    expect(result.state).toBe("DROWSY");
  });

  it("DISTRACTED: theta rising + focus falling during study", () => {
    const result = classifyBiometricState(
      makeWindow({
        hr_mean: 90,
        eeg_theta_rel: 0.35, // rising but not dominant
        focus_score_mean: 40, // falling but not collapsed (≥35 → not DROWSY)
      }),
      study,
    );
    expect(result.state).toBe("DISTRACTED");
  });

  it("DISTRACTED also applies to creative_work", () => {
    const result = classifyBiometricState(
      makeWindow({ hr_mean: 90, eeg_theta_rel: 0.35, focus_score_mean: 40 }),
      ACTIVITY_PROFILES.creative_work,
    );
    expect(result.state).toBe("DISTRACTED");
  });

  it("FATIGUED: declining HR + intensity drop + HRV collapse (physical, not cognitive)", () => {
    const result = classifyBiometricState(
      makeWindow({
        hr_mean: 126, // 70% — above cardio floor, so not UNDERPERFORMING
        hr_trend: -1,
        activity_intensity_mean: 2,
        hrv_rmssd_mean: 20,
        previous_state: "OPTIMAL", // not OVEREXERTING/FATIGUED → not RECOVERING
      }),
      cardio,
    );
    expect(result.state).toBe("FATIGUED");
  });

  it("UNDERPERFORMING: HR below the activity floor", () => {
    const result = classifyBiometricState(
      makeWindow({ hr_mean: 110 }), // 61% < 70% strength floor
      strength,
    );
    expect(result.state).toBe("UNDERPERFORMING");
  });

  it("OPTIMAL: in range but not yet sustained long enough for FLOW", () => {
    const result = classifyBiometricState(
      makeWindow({
        hr_mean: 130, // 72% — inside cardio optimal 65-80%
        time_in_current_state_s: 60,
      }),
      cardio,
    );
    expect(result.state).toBe("OPTIMAL");
  });

  it("FLOW requires the 10-minute sustain — same vitals at 9 minutes stay OPTIMAL", () => {
    const flowVitals = {
      hr_mean: 140,
      focus_score_mean: 80,
      stress_score_mean: 20,
      hrv_rmssd_mean: 55,
    };
    const at9min = classifyBiometricState(
      makeWindow({ ...flowVitals, time_in_current_state_s: 540 }),
      strength,
    );
    const at10min = classifyBiometricState(
      makeWindow({ ...flowVitals, time_in_current_state_s: 600 }),
      strength,
    );
    expect(at9min.state).toBe("OPTIMAL");
    expect(at10min.state).toBe("FLOW");
  });

  it("works HR-only: null EEG/stress fields never block classification", () => {
    const result = classifyBiometricState(
      makeWindow({
        hr_mean: 130,
        hrv_rmssd_mean: null,
        stress_score_mean: null,
        focus_score_mean: null,
        activity_intensity_mean: null,
      }),
      cardio,
    );
    expect(result.state).toBe("OPTIMAL");
  });
});

describe("validateBPMTransition — spec: no jump > 30 BPM unless urgency HIGH", () => {
  it("allows a 30 BPM jump at MEDIUM urgency", () => {
    expect(validateBPMTransition(120, 150, "MEDIUM").allowed).toBe(true);
  });

  it("rejects a 31 BPM jump at MEDIUM urgency", () => {
    const result = validateBPMTransition(120, 151, "MEDIUM");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("31");
  });

  it("rejects large jumps at LOW urgency too", () => {
    expect(validateBPMTransition(120, 160, "LOW").allowed).toBe(false);
  });

  it("HIGH urgency permits up to 60 BPM", () => {
    expect(validateBPMTransition(120, 179, "HIGH").allowed).toBe(true);
    expect(validateBPMTransition(120, 181, "HIGH").allowed).toBe(false);
  });

  it("direction does not matter — drops are limited like rises", () => {
    expect(validateBPMTransition(150, 115, "MEDIUM").allowed).toBe(false);
  });
});

describe("passesSpeechinessFilter — spec: never > 0.3 for study/meditation/sleep", () => {
  it.each(["study", "meditation", "sleep"])("blocks speechiness 0.31 for %s", (activity) => {
    expect(passesSpeechinessFilter(0.31, activity)).toBe(false);
  });

  it.each(["study", "meditation", "sleep"])("allows speechiness 0.3 for %s", (activity) => {
    expect(passesSpeechinessFilter(0.3, activity)).toBe(true);
  });

  it("does not restrict non-focus activities", () => {
    expect(passesSpeechinessFilter(0.9, "strength_training")).toBe(true);
    expect(passesSpeechinessFilter(0.9, "cardio")).toBe(true);
  });

  it("explicit user override wins", () => {
    expect(passesSpeechinessFilter(0.9, "study", true)).toBe(true);
  });

  it("unknown speechiness is not blocked", () => {
    expect(passesSpeechinessFilter(null, "study")).toBe(true);
  });
});

describe("resolveActivityProfile — UI taxonomy mapping", () => {
  it("maps UI activity names onto classifier profiles", () => {
    expect(resolveActivityProfile("workout").activity_type).toBe("strength_training");
    expect(resolveActivityProfile("relax").activity_type).toBe("recovery");
    expect(resolveActivityProfile("commute").activity_type).toBe("cardio");
  });

  it("passes through native profile keys, including sleep", () => {
    expect(resolveActivityProfile("sleep").activity_type).toBe("sleep");
    expect(resolveActivityProfile("cardio").activity_type).toBe("cardio");
  });

  it("falls back to study for unknown activities", () => {
    expect(resolveActivityProfile("interpretive_dance").activity_type).toBe("study");
  });
});
