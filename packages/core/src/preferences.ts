import type { UserPreferences } from "./types.js";

export interface FeedbackRecord {
  trackArtist: string;
  feedback: "up" | "down";
  targetTempo?: number | null;
  targetEnergy?: number | null;
}

const EMPTY: UserPreferences = { likedArtists: [], dislikedArtists: [] };

/**
 * Distil a user's thumbs up/down history into actionable preferences.
 * An artist disliked more often than liked is added to the avoid-list; the
 * liked tempo/energy ranges are the 10th–90th percentile of positive feedback
 * so a single outlier does not skew the envelope.
 */
export function derivePreferences(feedback: FeedbackRecord[]): UserPreferences {
  if (!feedback.length) return EMPTY;

  const byArtist = new Map<string, { up: number; down: number }>();
  const likedTempos: number[] = [];
  const likedEnergies: number[] = [];

  for (const f of feedback) {
    const key = f.trackArtist.trim().toLowerCase();
    if (key) {
      const tally = byArtist.get(key) ?? { up: 0, down: 0 };
      tally[f.feedback] += 1;
      byArtist.set(key, tally);
    }
    if (f.feedback === "up") {
      if (typeof f.targetTempo === "number") likedTempos.push(f.targetTempo);
      if (typeof f.targetEnergy === "number") likedEnergies.push(f.targetEnergy);
    }
  }

  const likedArtists: string[] = [];
  const dislikedArtists: string[] = [];
  for (const [artist, { up, down }] of byArtist) {
    if (up >= 2 && up > down) likedArtists.push(artist);
    else if (down >= 2 && down > up) dislikedArtists.push(artist);
  }

  return {
    likedArtists,
    dislikedArtists,
    likedTempoRange: percentileRange(likedTempos),
    likedEnergyRange: percentileRange(likedEnergies),
  };
}

function percentileRange(values: number[]): { min: number; max: number } | undefined {
  if (values.length < 3) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
  return { min: at(0.1), max: at(0.9) };
}
