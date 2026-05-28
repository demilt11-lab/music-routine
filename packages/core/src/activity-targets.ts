import type { Activity, ActivityTarget } from "./types.js";

/**
 * Physiological and musical envelopes per activity. Values are intentionally
 * conservative starting points; in production these are personalised per user
 * over time by blending in their feedback history (see `preferences.ts`).
 */
export const ACTIVITY_TARGETS: Record<Activity, ActivityTarget> = {
  workout: {
    heartRate: { min: 120, max: 160 },
    maxStress: 55,
    minFocus: 45,
    tempo: { min: 130, max: 165 },
    energy: { min: 0.7, max: 0.95 },
    valence: { min: 0.5, max: 0.9 },
  },
  study: {
    heartRate: { min: 60, max: 85 },
    maxStress: 30,
    minFocus: 70,
    tempo: { min: 90, max: 125 },
    energy: { min: 0.3, max: 0.6 },
    valence: { min: 0.3, max: 0.6 },
  },
  sleep: {
    heartRate: { min: 48, max: 65 },
    maxStress: 15,
    minFocus: 15,
    tempo: { min: 45, max: 75 },
    energy: { min: 0.03, max: 0.25 },
    valence: { min: 0.2, max: 0.5 },
  },
  relax: {
    heartRate: { min: 55, max: 78 },
    maxStress: 22,
    minFocus: 35,
    tempo: { min: 65, max: 100 },
    energy: { min: 0.2, max: 0.45 },
    valence: { min: 0.35, max: 0.7 },
  },
  commute: {
    heartRate: { min: 65, max: 100 },
    maxStress: 38,
    minFocus: 50,
    tempo: { min: 100, max: 140 },
    energy: { min: 0.5, max: 0.8 },
    valence: { min: 0.4, max: 0.85 },
  },
  meditation: {
    heartRate: { min: 50, max: 70 },
    maxStress: 18,
    minFocus: 55,
    tempo: { min: 50, max: 80 },
    energy: { min: 0.05, max: 0.3 },
    valence: { min: 0.3, max: 0.6 },
  },
};

export function getActivityTarget(activity: Activity): ActivityTarget {
  return ACTIVITY_TARGETS[activity] ?? ACTIVITY_TARGETS.study;
}
