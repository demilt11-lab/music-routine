import { getActivityTarget } from "./activity-targets.js";
import { deriveFlowState } from "./flow.js";
import { analyzeTrend } from "./trend.js";
import type {
  ActivityTarget,
  AdaptiveAction,
  AdaptiveInput,
  AdaptiveRecommendation,
  BiometricSample,
  BiometricTrend,
  FlowState,
  UserPreferences,
} from "./types.js";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const mid = (r: { min: number; max: number }) => (r.min + r.max) / 2;

/**
 * The deterministic heart of BioMusic. Given the current biometric sample,
 * recent history, the chosen activity, and learned preferences, it returns a
 * concrete, safe music adjustment plus feature "seeds" a provider can use to
 * fetch candidate tracks.
 *
 * This function is pure and side-effect free so it can run identically on the
 * client (instant, offline) and in the adaptive service (where an LLM may
 * enrich the `reasoning`/`flowPrediction` copy). It is always a complete,
 * valid recommendation on its own — the LLM is an enhancement, never a
 * dependency.
 */
export function recommend(input: AdaptiveInput): AdaptiveRecommendation {
  const target = getActivityTarget(input.activity);
  const history = input.history ?? [];
  const { state: flow, score } = deriveFlowState(input.sample, history, target);
  const trend = analyzeTrend(history);

  const action = chooseAction(input.sample, target, flow, trend);
  const { targetTempo, targetEnergy, targetValence } = computeTargets(
    action,
    target,
    input.currentTrack?.tempo,
    input.preferences,
  );

  const seeds = buildSeeds(targetTempo, targetEnergy, targetValence, target, input.preferences);
  const confidence = signalConfidence(input.sample, history);

  return {
    action,
    targetTempo,
    targetEnergy,
    targetValence,
    confidence,
    reasoning: explain(action, input.sample, target, trend, flow),
    flowPrediction: predictFlow(flow, trend, score),
    seeds,
  };
}

function chooseAction(
  s: BiometricSample,
  t: ActivityTarget,
  flow: FlowState,
  trend: BiometricTrend,
): AdaptiveAction {
  // While solidly in flow, the safest move is almost always to hold course.
  if (flow === "in_flow" && trend.direction !== "declining" && trend.direction !== "stress_rising") {
    return "maintain";
  }

  if (s.heartRate != null) {
    if (s.heartRate > t.heartRate.max) return "decrease_tempo";
    if (s.heartRate < t.heartRate.min) return "increase_tempo";
  }
  if (s.stressLevel != null && s.stressLevel > t.maxStress) return "decrease_energy";
  if (s.focusScore != null && s.focusScore < t.minFocus) {
    const stressOk = s.stressLevel == null || s.stressLevel < t.maxStress;
    return stressOk ? "increase_energy" : "decrease_energy";
  }
  if (trend.direction === "declining" || flow === "exiting") return "change_genre";
  return "maintain";
}

function computeTargets(
  action: AdaptiveAction,
  t: ActivityTarget,
  currentTempo: number | undefined,
  prefs: UserPreferences | undefined,
): { targetTempo: number; targetEnergy: number; targetValence: number } {
  const baseTempo = currentTempo ?? mid(t.tempo);
  const step = 12; // bpm — gradual entrainment beats abrupt jumps
  let tempo = mid(t.tempo);
  let energy = mid(t.energy);

  switch (action) {
    case "increase_tempo":
      tempo = clamp(baseTempo + step, t.tempo.min, t.tempo.max);
      energy = clamp(mid(t.energy) + 0.1, t.energy.min, t.energy.max);
      break;
    case "decrease_tempo":
      tempo = clamp(baseTempo - step, t.tempo.min, t.tempo.max);
      energy = clamp(mid(t.energy) - 0.1, t.energy.min, t.energy.max);
      break;
    case "increase_energy":
      energy = clamp(mid(t.energy) + 0.15, t.energy.min, t.energy.max);
      tempo = clamp(baseTempo, t.tempo.min, t.tempo.max);
      break;
    case "decrease_energy":
      energy = clamp(mid(t.energy) - 0.15, t.energy.min, t.energy.max);
      tempo = clamp(baseTempo, t.tempo.min, t.tempo.max);
      break;
    case "maintain":
      tempo = clamp(baseTempo, t.tempo.min, t.tempo.max);
      energy = mid(t.energy);
      break;
    case "change_genre":
      tempo = mid(t.tempo);
      energy = mid(t.energy);
      break;
  }

  // Nudge toward the user's learned sweet spot when we have one.
  if (prefs?.likedTempoRange) {
    const liked = clamp(mid(prefs.likedTempoRange), t.tempo.min, t.tempo.max);
    tempo = Math.round(tempo * 0.7 + liked * 0.3);
  }
  if (prefs?.likedEnergyRange) {
    const liked = clamp(mid(prefs.likedEnergyRange), t.energy.min, t.energy.max);
    energy = energy * 0.7 + liked * 0.3;
  }

  return {
    targetTempo: Math.round(tempo),
    targetEnergy: round2(energy),
    targetValence: round2(mid(t.valence)),
  };
}

function buildSeeds(
  tempo: number,
  energy: number,
  valence: number,
  t: ActivityTarget,
  prefs: UserPreferences | undefined,
): AdaptiveRecommendation["seeds"] {
  return {
    tempo: { min: Math.max(t.tempo.min, Math.round(tempo - 10)), max: Math.min(t.tempo.max, Math.round(tempo + 10)) },
    energy: { min: round2(Math.max(t.energy.min, energy - 0.1)), max: round2(Math.min(t.energy.max, energy + 0.1)) },
    valence: { min: round2(Math.max(0, valence - 0.15)), max: round2(Math.min(1, valence + 0.15)) },
    avoidArtists: prefs?.dislikedArtists ?? [],
    preferArtists: prefs?.likedArtists ?? [],
  };
}

/** Confidence scales with how many independent signals we have and how deep the history is. */
function signalConfidence(sample: BiometricSample, history: BiometricSample[]): number {
  const signals = [sample.heartRate, sample.hrv, sample.stressLevel, sample.focusScore, sample.eeg].filter(
    (x) => x != null,
  ).length;
  const signalScore = clamp(signals / 4, 0, 1);
  const historyScore = clamp(history.length / 10, 0, 1);
  return round2(0.4 + 0.4 * signalScore + 0.2 * historyScore);
}

function explain(
  action: AdaptiveAction,
  s: BiometricSample,
  t: ActivityTarget,
  trend: BiometricTrend,
  flow: FlowState,
): string {
  const bits: string[] = [];
  if (s.heartRate != null) bits.push(`HR ${s.heartRate}bpm (target ${t.heartRate.min}–${t.heartRate.max})`);
  if (s.stressLevel != null) bits.push(`stress ${Math.round(s.stressLevel)}% (max ${t.maxStress})`);
  if (s.focusScore != null) bits.push(`focus ${Math.round(s.focusScore)}% (min ${t.minFocus})`);

  const verb: Record<AdaptiveAction, string> = {
    increase_tempo: "Lifting tempo to raise arousal toward the target band",
    decrease_tempo: "Easing tempo to bring heart rate down via rhythmic entrainment",
    increase_energy: "Adding energy to sharpen focus without spiking stress",
    decrease_energy: "Softening energy to relieve elevated stress",
    maintain: "Holding the current soundscape to preserve flow",
    change_genre: "Shifting genre to re-engage and recover flow",
  };
  return `${verb[action]}. State: ${flow.replace("_", " ")}; ${trend.description} ${bits.join(", ")}.`.trim();
}

function predictFlow(flow: FlowState, trend: BiometricTrend, score: number): string {
  if (flow === "in_flow") return "Expect flow to hold for the next several minutes.";
  if (trend.direction === "improving" || flow === "entering") {
    return "On track to reach flow within ~2–4 minutes if signals keep improving.";
  }
  if (trend.direction === "declining" || flow === "exiting") {
    return "Flow is slipping; this correction should stabilise it within ~3 minutes.";
  }
  return `Building toward flow (current readiness ${Math.round(score * 100)}%).`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
