// Pure helpers for the client-side reactive engine loop: rolling-window
// feature extraction from biometric readings, state persistence tracking,
// and duration-gated trigger decisions. Kept free of React so they are
// unit-testable (src/test/biometric-window.test.ts).

import type { BiometricWindow, StateClass } from "./classifier";

export interface ReadingLike {
  heartRate: number;
  heartRateVariability?: number;
  stressLevel?: number;
  relaxationScore?: number;
  focusScore?: number;
  eegAlpha?: number;
  eegBeta?: number;
  eegTheta?: number;
  eegGamma?: number;
  eegDelta?: number;
  recordedAt: Date;
}

const OPTIMAL_FAMILY: StateClass[] = ["OPTIMAL", "FLOW"];

export function isOptimalFamily(state: StateClass): boolean {
  return OPTIMAL_FAMILY.includes(state);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function std(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values)!;
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

// Least-squares slope of HR over time, in BPM per second.
function hrSlope(points: Array<{ t: number; hr: number }>): number {
  if (points.length < 2) return 0;
  const n = points.length;
  const t0 = points[0].t;
  const xs = points.map((p) => (p.t - t0) / 1000);
  const ys = points.map((p) => p.hr);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export interface WindowContext {
  hrmaxEstimate: number;
  restingHr: number;
  timeInCurrentStateS: number;
  previousState: StateClass | null;
  windowS?: number; // rolling window length, default 30s per spec
  now?: number;
}

/**
 * Builds the classifier's 30-second BiometricWindow from raw readings.
 * Readings outside the window are ignored; EEG relative band powers are
 * only produced when EEG data is actually present (HR-only stays null so
 * the classifier's null-tolerant gates behave correctly).
 */
export function computeBiometricWindow(
  readings: ReadingLike[],
  ctx: WindowContext,
): BiometricWindow | null {
  const now = ctx.now ?? Date.now();
  const windowMs = (ctx.windowS ?? 30) * 1000;
  const recent = readings.filter((r) => now - r.recordedAt.getTime() <= windowMs);
  if (recent.length < 2) return null;

  const hrs = recent.map((r) => r.heartRate);
  const eegPresent = recent.some((r) => r.eegAlpha !== undefined && r.eegAlpha !== null);

  let alphaRel: number | null = null;
  let betaRel: number | null = null;
  let thetaRel: number | null = null;
  if (eegPresent) {
    const withEeg = recent.filter((r) => r.eegAlpha !== undefined && r.eegAlpha !== null);
    const alpha = mean(withEeg.map((r) => r.eegAlpha ?? 0)) ?? 0;
    const beta  = mean(withEeg.map((r) => r.eegBeta ?? 0)) ?? 0;
    const theta = mean(withEeg.map((r) => r.eegTheta ?? 0)) ?? 0;
    const gamma = mean(withEeg.map((r) => r.eegGamma ?? 0)) ?? 0;
    const delta = mean(withEeg.map((r) => r.eegDelta ?? 0)) ?? 0;
    const total = alpha + beta + theta + gamma + delta;
    if (total > 0) {
      alphaRel = alpha / total;
      betaRel  = beta / total;
      thetaRel = theta / total;
    }
  }

  return {
    hr_mean: mean(hrs)!,
    hr_std: std(hrs),
    hr_trend: hrSlope(recent.map((r) => ({ t: r.recordedAt.getTime(), hr: r.heartRate }))),
    hrv_rmssd_mean: mean(recent.map((r) => r.heartRateVariability).filter((v): v is number => v != null)),
    hrmax_estimate: ctx.hrmaxEstimate,
    resting_hr: ctx.restingHr,
    respiratory_rate_mean: null,
    eda_mean: null,
    stress_score_mean: mean(recent.map((r) => r.stressLevel).filter((v): v is number => v != null)),
    eeg_alpha_rel: alphaRel,
    eeg_beta_rel: betaRel,
    eeg_theta_rel: thetaRel,
    focus_score_mean: mean(recent.map((r) => r.focusScore).filter((v): v is number => v != null)),
    calm_score_mean: mean(recent.map((r) => r.relaxationScore).filter((v): v is number => v != null)),
    activity_intensity_mean: null,
    steps_per_minute_mean: null,
    time_in_current_state_s: ctx.timeInCurrentStateS,
    previous_state: ctx.previousState,
  };
}

/**
 * Tracks how long the user has been in the current state. OPTIMAL and FLOW
 * count as one "optimal family" so the 10-minute FLOW sustain isn't reset
 * by the OPTIMAL→FLOW upgrade itself.
 */
export class StateTracker {
  private current: StateClass | null = null;
  private previousDistinct: StateClass | null = null;
  private stateSince = 0;
  private familySince = 0;

  /** Seconds to feed the classifier as time_in_current_state_s. */
  timeInStateS(now: number): number {
    if (this.current === null) return 0;
    const since = isOptimalFamily(this.current) ? this.familySince : this.stateSince;
    return Math.floor((now - since) / 1000);
  }

  get previousState(): StateClass | null {
    return this.previousDistinct;
  }

  get currentState(): StateClass | null {
    return this.current;
  }

  optimalFamilySeconds(now: number): number {
    if (this.current === null || !isOptimalFamily(this.current)) return 0;
    return Math.floor((now - this.familySince) / 1000);
  }

  update(state: StateClass, now: number): void {
    if (this.current === null) {
      this.current = state;
      this.stateSince = now;
      this.familySince = now;
      return;
    }
    if (state !== this.current) {
      const familyChanged = isOptimalFamily(state) !== isOptimalFamily(this.current);
      this.previousDistinct = this.current;
      this.current = state;
      this.stateSince = now;
      if (familyChanged) this.familySince = now;
    }
  }
}

export type Urgency = "LOW" | "MEDIUM" | "HIGH";

export interface TriggerDecision {
  fire: boolean;
  urgency: Urgency;
}

const HIGH_URGENCY_STATES: StateClass[] = ["OVEREXERTING", "ANXIOUS"];

/**
 * Duration-gated trigger evaluation (Module 3 step 4): a non-optimal state
 * must persist across consecutive evaluations before the engine reacts, the
 * threshold rises while flow-maintenance mode is active (don't disrupt
 * flow for transient wobble), and song changes are rate-limited.
 */
export class TriggerGate {
  private consecutiveNonOptimal = 0;
  private lastFireAt = 0;

  constructor(
    private readonly opts: {
      ticksRequired?: number;            // default 3 (15s at 5s cadence)
      ticksRequiredInMaintenance?: number; // default 6 (30s)
      cooldownMs?: number;               // default 60s between song changes
    } = {},
  ) {}

  evaluate(state: StateClass, maintenanceMode: boolean, now: number): TriggerDecision {
    const urgency: Urgency = HIGH_URGENCY_STATES.includes(state) ? "HIGH" : "MEDIUM";

    if (isOptimalFamily(state)) {
      this.consecutiveNonOptimal = 0;
      return { fire: false, urgency: "LOW" };
    }

    this.consecutiveNonOptimal += 1;
    const required = maintenanceMode
      ? this.opts.ticksRequiredInMaintenance ?? 6
      : this.opts.ticksRequired ?? 3;
    const cooledDown = now - this.lastFireAt >= (this.opts.cooldownMs ?? 60_000);

    if (this.consecutiveNonOptimal >= required && cooledDown) {
      this.lastFireAt = now;
      this.consecutiveNonOptimal = 0; // must re-sustain before firing again
      return { fire: true, urgency };
    }
    return { fire: false, urgency };
  }
}

/**
 * Song-response training signal (Module 5 step 6): mean vitals in the 30s
 * before the song started vs the 60s after. Null when there isn't enough
 * data on either side.
 */
export function computeTrackResponse(
  readings: ReadingLike[],
  startedAtMs: number,
): { hr_delta: number | null; focus_delta: number | null } {
  const pre = readings.filter(
    (r) => r.recordedAt.getTime() >= startedAtMs - 30_000 && r.recordedAt.getTime() < startedAtMs,
  );
  const post = readings.filter(
    (r) => r.recordedAt.getTime() >= startedAtMs && r.recordedAt.getTime() <= startedAtMs + 60_000,
  );
  if (pre.length === 0 || post.length === 0) return { hr_delta: null, focus_delta: null };

  const preHr = mean(pre.map((r) => r.heartRate));
  const postHr = mean(post.map((r) => r.heartRate));
  const preFocus = mean(pre.map((r) => r.focusScore).filter((v): v is number => v != null));
  const postFocus = mean(post.map((r) => r.focusScore).filter((v): v is number => v != null));

  return {
    hr_delta: preHr != null && postHr != null ? postHr - preHr : null,
    focus_delta: preFocus != null && postFocus != null ? postFocus - preFocus : null,
  };
}
