import type { ActivityTarget, BiometricSample, FlowState } from "./types.js";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Estimate a 0–1 "flow score" from the available signals relative to the
 * activity's target envelope. We combine whichever signals are present and
 * weight them; missing signals are simply excluded so the score degrades
 * gracefully from EEG-grade hardware down to a phone-only experience.
 */
export function flowScore(sample: BiometricSample, target: ActivityTarget): number {
  const parts: Array<{ value: number; weight: number }> = [];

  if (sample.focusScore != null) {
    parts.push({ value: sample.focusScore / 100, weight: 0.35 });
  }
  if (sample.stressLevel != null) {
    // Lower stress (relative to the activity ceiling) is better.
    const headroom = clamp((target.maxStress - sample.stressLevel) / target.maxStress, 0, 1);
    parts.push({ value: headroom, weight: 0.25 });
  }
  if (sample.heartRate != null) {
    parts.push({ value: heartRateFit(sample.heartRate, target), weight: 0.2 });
  }
  if (sample.eeg) {
    // Alpha dominance over beta indicates calm, engaged focus.
    const ratio = sample.eeg.alpha / (sample.eeg.beta + 0.001);
    parts.push({ value: clamp(ratio / 2, 0, 1), weight: 0.2 });
  } else if (sample.relaxationScore != null) {
    parts.push({ value: sample.relaxationScore / 100, weight: 0.2 });
  }

  if (parts.length === 0) return 0.5; // no signal: assume neutral
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  return clamp(parts.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight, 0, 1);
}

/** 1.0 when heart rate sits in the target band, decaying linearly outside it. */
function heartRateFit(hr: number, target: ActivityTarget): number {
  const { min, max } = target.heartRate;
  if (hr >= min && hr <= max) return 1;
  const span = max - min || 1;
  const distance = hr < min ? min - hr : hr - max;
  return clamp(1 - distance / span, 0, 1);
}

/**
 * Classify the flow state from the current score and its recent trajectory.
 * Hysteresis (different enter/exit thresholds) avoids flapping between states.
 */
export function classifyFlowState(current: number, previous: number | undefined): FlowState {
  const delta = previous == null ? 0 : current - previous;

  if (current >= 0.72) return "in_flow";
  if (current >= 0.55) return delta >= 0.02 ? "entering" : "in_flow";
  if (current >= 0.4) return delta < -0.02 ? "exiting" : "entering";
  return previous != null && previous >= 0.55 ? "exiting" : "none";
}

/** Convenience: derive a flow state for a sample given recent history. */
export function deriveFlowState(
  sample: BiometricSample,
  history: BiometricSample[],
  target: ActivityTarget,
): { state: FlowState; score: number } {
  const score = flowScore(sample, target);
  const prevSample = history.length > 0 ? history[history.length - 1] : undefined;
  const prev = prevSample ? flowScore(prevSample, target) : undefined;
  return { state: classifyFlowState(score, prev), score };
}
