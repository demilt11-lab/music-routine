/**
 * Pure biometric state classifier — shared between the Supabase edge function
 * (supabase/functions/state-classifier/index.ts) and the frontend test suite.
 *
 * No Deno or browser globals — pure TypeScript functions only.
 */

export type StateClass =
  | "OPTIMAL" | "UNDERPERFORMING" | "OVEREXERTING"
  | "ANXIOUS" | "DISTRACTED" | "DROWSY" | "FATIGUED"
  | "FLOW" | "RECOVERING";

export interface BiometricWindow {
  hr_mean: number;
  hr_std: number;
  hr_trend: number;
  hrv_rmssd_mean: number | null;
  hrmax_estimate: number;
  resting_hr: number;
  respiratory_rate_mean: number | null;
  eda_mean: number | null;
  stress_score_mean: number | null;
  eeg_alpha_rel: number | null;
  eeg_beta_rel: number | null;
  eeg_theta_rel: number | null;
  focus_score_mean: number | null;
  calm_score_mean: number | null;
  activity_intensity_mean: number | null;
  steps_per_minute_mean: number | null;
  time_in_current_state_s: number;
  previous_state: StateClass | null;
}

export interface ActivityProfile {
  activity_type: string;
  hr_min_pct: number;
  hr_max_pct: number;
  hr_optimal_min_pct: number;
  hr_optimal_max_pct: number;
  hrv_target: "high" | "moderate" | "low" | null;
  eeg_target: "alpha" | "beta" | "theta" | "alpha_theta" | null;
  focus_threshold: number | null;
  stress_max: number | null;
}

export interface ClassificationResult {
  state: StateClass;
  confidence: number;
  key_signals: string[];
  time_in_state: number;
  transition_from: StateClass | null;
}

export const ACTIVITY_PROFILES: Record<string, ActivityProfile> = {
  strength_training: {
    activity_type: "strength_training",
    hr_min_pct: 0.70, hr_max_pct: 0.90,
    hr_optimal_min_pct: 0.75, hr_optimal_max_pct: 0.82,
    hrv_target: "moderate", eeg_target: "beta",
    focus_threshold: null, stress_max: 60,
  },
  cardio: {
    activity_type: "cardio",
    hr_min_pct: 0.65, hr_max_pct: 0.88,
    hr_optimal_min_pct: 0.65, hr_optimal_max_pct: 0.80,
    hrv_target: "moderate", eeg_target: null,
    focus_threshold: null, stress_max: 70,
  },
  yoga: {
    activity_type: "yoga",
    hr_min_pct: 0.50, hr_max_pct: 0.65,
    hr_optimal_min_pct: 0.50, hr_optimal_max_pct: 0.65,
    hrv_target: "high", eeg_target: "alpha",
    focus_threshold: null, stress_max: 40,
  },
  study: {
    activity_type: "study",
    hr_min_pct: 0, hr_max_pct: 1,
    hr_optimal_min_pct: 0, hr_optimal_max_pct: 1,
    hrv_target: "high", eeg_target: "alpha",
    focus_threshold: 60, stress_max: 35,
  },
  meditation: {
    activity_type: "meditation",
    hr_min_pct: 0, hr_max_pct: 1,
    hr_optimal_min_pct: 0, hr_optimal_max_pct: 1,
    hrv_target: "high", eeg_target: "alpha_theta",
    focus_threshold: null, stress_max: 20,
  },
  creative_work: {
    activity_type: "creative_work",
    hr_min_pct: 0, hr_max_pct: 1,
    hr_optimal_min_pct: 0, hr_optimal_max_pct: 1,
    hrv_target: "high", eeg_target: "alpha_theta",
    focus_threshold: 50, stress_max: 40,
  },
  recovery: {
    activity_type: "recovery",
    hr_min_pct: 0, hr_max_pct: 0.65,
    hr_optimal_min_pct: 0, hr_optimal_max_pct: 0.60,
    hrv_target: "high", eeg_target: null,
    focus_threshold: null, stress_max: 30,
  },
  sleep: {
    activity_type: "sleep",
    hr_min_pct: 0, hr_max_pct: 0.55,
    hr_optimal_min_pct: 0, hr_optimal_max_pct: 0.50,
    hrv_target: "high", eeg_target: "theta",
    focus_threshold: null, stress_max: 20,
  },
};

export function classifyBiometricState(
  window: BiometricWindow,
  profile: ActivityProfile,
): ClassificationResult {
  const signals: string[] = [];

  if (!window.hrmax_estimate || window.hrmax_estimate <= 0 || !Number.isFinite(window.hr_mean)) {
    return {
      state: "OPTIMAL",
      confidence: 0.40,
      key_signals: ["insufficient_data: hr or hrmax unavailable"],
      time_in_state: window.time_in_current_state_s,
      transition_from: window.previous_state,
    };
  }

  const hrPct = window.hr_mean / window.hrmax_estimate;

  const inOptimalHR = hrPct >= profile.hr_optimal_min_pct && hrPct <= profile.hr_optimal_max_pct;
  const hrStable    = window.hr_std < 5;
  const focusHigh   = window.focus_score_mean === null || window.focus_score_mean > 70;
  const alphaOk     = window.eeg_alpha_rel === null || window.eeg_alpha_rel > 0.3;
  const lowStress   = window.stress_score_mean === null || window.stress_score_mean < (profile.stress_max ?? 50);
  const sustained   = window.time_in_current_state_s >= 600;
  const hrvOk       = window.hrv_rmssd_mean === null || window.hrv_rmssd_mean > 40;

  if (inOptimalHR && hrStable && focusHigh && lowStress && alphaOk && hrvOk && sustained) {
    signals.push("HR in optimal range", "stable variability", "HRV adequate", "focus high", "sustained 10+ min");
    return { state: "FLOW", confidence: 0.90, key_signals: signals,
             time_in_state: window.time_in_current_state_s, transition_from: window.previous_state };
  }

  const betaHigh   = window.eeg_beta_rel !== null && window.eeg_beta_rel > 0.45;
  const stressHigh = window.stress_score_mean !== null && window.stress_score_mean > (profile.stress_max ?? 50);
  const hrvDrop    = window.hrv_rmssd_mean !== null && window.hrv_rmssd_mean < 30;
  const hrElevated = hrPct > 0.75;
  if (betaHigh && stressHigh && hrElevated && hrvDrop) {
    signals.push("elevated beta", "high stress", "HRV drop");
    return { state: "ANXIOUS", confidence: 0.85, key_signals: signals,
             time_in_state: window.time_in_current_state_s, transition_from: window.previous_state };
  }

  if (hrPct > profile.hr_max_pct) {
    signals.push(`HR ${(hrPct * 100).toFixed(0)}% > ${(profile.hr_max_pct * 100).toFixed(0)}% max`);
    return { state: "OVEREXERTING", confidence: 0.88, key_signals: signals,
             time_in_state: window.time_in_current_state_s, transition_from: window.previous_state };
  }

  const decliningHR = window.hr_trend < -0.5;
  if (decliningHR && hrPct > 0.55 &&
      (window.previous_state === "OVEREXERTING" || window.previous_state === "FATIGUED")) {
    signals.push("HR declining post-exertion");
    return { state: "RECOVERING", confidence: 0.80, key_signals: signals,
             time_in_state: window.time_in_current_state_s, transition_from: window.previous_state };
  }

  const thetaDominant = window.eeg_theta_rel !== null && window.eeg_theta_rel > 0.40;
  const focusLow      = window.focus_score_mean !== null && window.focus_score_mean < 35;
  const hrResting     = hrPct < 0.60;
  if (thetaDominant && focusLow && hrResting) {
    signals.push("theta dominant", "focus low", "HR near resting");
    return { state: "DROWSY", confidence: 0.82, key_signals: signals,
             time_in_state: window.time_in_current_state_s, transition_from: window.previous_state };
  }

  const thetaRising  = window.eeg_theta_rel !== null && window.eeg_theta_rel > 0.30;
  const focusFalling = window.focus_score_mean !== null && window.focus_score_mean < 45;
  if (["study", "creative_work"].includes(profile.activity_type) && thetaRising && focusFalling) {
    signals.push("theta rising", "focus score falling");
    return { state: "DISTRACTED", confidence: 0.75, key_signals: signals,
             time_in_state: window.time_in_current_state_s, transition_from: window.previous_state };
  }

  const intensityDrop = window.activity_intensity_mean !== null && window.activity_intensity_mean < 3;
  const hrvFatigue    = window.hrv_rmssd_mean !== null && window.hrv_rmssd_mean < 25;
  if (decliningHR && intensityDrop && hrvFatigue) {
    signals.push("declining HR+intensity", "HRV drop = physical fatigue");
    return { state: "FATIGUED", confidence: 0.78, key_signals: signals,
             time_in_state: window.time_in_current_state_s, transition_from: window.previous_state };
  }

  if (hrPct < profile.hr_min_pct) {
    signals.push(`HR ${(hrPct * 100).toFixed(0)}% < ${(profile.hr_min_pct * 100).toFixed(0)}% floor`);
    return { state: "UNDERPERFORMING", confidence: 0.80, key_signals: signals,
             time_in_state: window.time_in_current_state_s, transition_from: window.previous_state };
  }

  signals.push("all vitals in range");
  const confidence = inOptimalHR && hrStable ? 0.85 : 0.65;
  return { state: "OPTIMAL", confidence, key_signals: signals,
           time_in_state: window.time_in_current_state_s, transition_from: window.previous_state };
}

export function validateBPMTransition(
  currentBPM: number,
  nextBPM: number,
  urgency: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM",
): { allowed: boolean; reason?: string } {
  const delta = Math.abs(nextBPM - currentBPM);
  const limit = urgency === "HIGH" ? 60 : 30;
  if (delta > limit) {
    return { allowed: false,
      reason: `BPM jump of ${delta} exceeds limit of ${limit} for urgency=${urgency}` };
  }
  return { allowed: true };
}

export function passesSpeechinessFilter(
  speechiness: number | null,
  activityType: string,
  userOverride = false,
): boolean {
  const strictActivities = ["study", "meditation", "sleep"];
  if (!strictActivities.includes(activityType)) return true;
  if (userOverride) return true;
  if (speechiness === null) return true;
  return speechiness <= 0.15;
}
