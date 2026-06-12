// Music response model selection logic (spec Modules 4 & 7) — pure TS,
// shared by the playlist-engine edge function and the vitest suite.

export interface ResponseProfile {
  avg_hr_delta_60s: number | null;
  avg_focus_delta_60s: number | null;
  avg_stress_delta_60s: number | null;
}

/**
 * Personal-model weight per spec Module 7: the personal model activates
 * after 5 sessions and its blend weight grows with session count, capped at
 * 0.85 (population floor 0.15).
 */
export function personalModelWeight(sessionCount: number): number {
  if (sessionCount < 5) return 0;
  return Math.min(0.85, sessionCount * 0.05);
}

/**
 * Blend a personal response value with the population value. Falls back to
 * whichever side has data; null only when neither does.
 */
export function blendDelta(
  personal: number | null,
  population: number | null,
  personalWeight: number,
): number | null {
  if (personal === null && population === null) return null;
  if (personal === null) return population;
  if (population === null) return personal;
  return personal * personalWeight + population * (1 - personalWeight);
}

export function blendProfiles(
  personal: ResponseProfile,
  population: ResponseProfile | null,
  sessionCount: number,
): ResponseProfile {
  const w = personalModelWeight(sessionCount);
  const pop = population ?? { avg_hr_delta_60s: null, avg_focus_delta_60s: null, avg_stress_delta_60s: null };
  return {
    avg_hr_delta_60s: blendDelta(personal.avg_hr_delta_60s, pop.avg_hr_delta_60s, w),
    avg_focus_delta_60s: blendDelta(personal.avg_focus_delta_60s, pop.avg_focus_delta_60s, w),
    avg_stress_delta_60s: blendDelta(personal.avg_stress_delta_60s, pop.avg_stress_delta_60s, w),
  };
}

export interface SequenceCandidate {
  id: string;
  tempo: number | null;
  score: number;
}

/**
 * Progressive transition sequence (spec Module 4): for gradual transitions,
 * pick up to `length` follow-up songs stepping ≤ maxStepBpm per hop from the
 * lead song's BPM toward the target range midpoint. Greedy: at each hop,
 * take the highest-scored candidate inside the step window that moves
 * toward (or stays at) the target.
 */
export function pickTransitionSequence(
  candidates: SequenceCandidate[],
  leadBpm: number,
  targetBpmMin: number,
  targetBpmMax: number,
  opts: { maxStepBpm?: number; length?: number } = {},
): SequenceCandidate[] {
  const maxStep = opts.maxStepBpm ?? 15;
  const length = opts.length ?? 2;
  const targetMid = (targetBpmMin + targetBpmMax) / 2;

  const sequence: SequenceCandidate[] = [];
  const used = new Set<string>();
  let currentBpm = leadBpm;

  for (let hop = 0; hop < length; hop++) {
    const distanceNow = Math.abs(currentBpm - targetMid);
    const eligible = candidates.filter((c) => {
      if (used.has(c.id) || c.tempo === null) return false;
      if (Math.abs(c.tempo - currentBpm) > maxStep) return false;
      // must not move away from the target
      return Math.abs(c.tempo - targetMid) <= distanceNow + 0.001;
    });
    if (eligible.length === 0) break;

    eligible.sort((a, b) => b.score - a.score);
    const pick = eligible[0];
    sequence.push(pick);
    used.add(pick.id);
    currentBpm = pick.tempo!;
  }

  return sequence;
}
