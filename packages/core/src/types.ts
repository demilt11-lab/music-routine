/**
 * Core domain types shared across the web client, the adaptive service, and
 * Supabase edge functions. These are framework-agnostic and have no runtime
 * dependencies so they can run in the browser, on Node, and on Deno.
 */

export const ACTIVITIES = [
  "workout",
  "study",
  "sleep",
  "relax",
  "commute",
  "meditation",
] as const;

export type Activity = (typeof ACTIVITIES)[number];

/**
 * Coarse flow-state classification derived from biometric signals.
 * `entering` / `exiting` are transitional and let the engine make gentle
 * corrections before the user fully leaves an optimal state.
 */
export type FlowState = "none" | "entering" | "in_flow" | "exiting";

/** Raw electroencephalography band powers in microvolts (optional, EEG headbands only). */
export interface EegBands {
  alpha: number;
  beta: number;
  theta: number;
  gamma: number;
  delta: number;
}

/**
 * A single point-in-time biometric reading. Every field except `recordedAt`
 * is optional because the available signals depend on the connected device
 * (phone-only, Apple Watch, chest strap, or an EEG headband).
 */
export interface BiometricSample {
  recordedAt: string; // ISO-8601
  heartRate?: number; // bpm
  hrv?: number; // ms (RMSSD)
  /** 0–100, higher = more stressed. Derived on-device or from HRV. */
  stressLevel?: number;
  /** 0–100, higher = more focused. */
  focusScore?: number;
  /** 0–100, higher = more relaxed. */
  relaxationScore?: number;
  eeg?: EegBands;
  /** 0–100 meditation depth (EEG-derived). */
  meditationScore?: number;
  deviceType?: string;
}

/** Audio characteristics of a track, normalised to the Spotify feature scale. */
export interface TrackFeatures {
  tempo: number; // bpm
  energy: number; // 0–1
  valence: number; // 0–1 (musical positiveness)
  danceability?: number; // 0–1
}

export interface Track extends Partial<TrackFeatures> {
  id?: string;
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  provider?: MusicProviderId;
  providerTrackId?: string;
  artworkUrl?: string;
  previewUrl?: string;
}

export type MusicProviderId = "spotify" | "apple_music" | "jamendo" | "youtube";

/**
 * Per-activity physiological and musical envelope. The engine steers the user
 * toward the centre of these ranges.
 */
export interface ActivityTarget {
  heartRate: { min: number; max: number };
  maxStress: number;
  minFocus: number;
  tempo: { min: number; max: number };
  energy: { min: number; max: number };
  valence: { min: number; max: number };
}

export type AdaptiveAction =
  | "increase_tempo"
  | "decrease_tempo"
  | "increase_energy"
  | "decrease_energy"
  | "maintain"
  | "change_genre";

export type TrendDirection =
  | "improving"
  | "declining"
  | "focus_rising"
  | "stress_rising"
  | "stable";

export interface BiometricTrend {
  direction: TrendDirection;
  description: string;
  focusDelta: number;
  stressDelta: number;
}

/** Preferences distilled from a user's thumbs up/down history. */
export interface UserPreferences {
  likedArtists: string[];
  dislikedArtists: string[];
  likedTempoRange?: { min: number; max: number };
  likedEnergyRange?: { min: number; max: number };
}

/** The deterministic decision produced by the adaptive engine. */
export interface AdaptiveRecommendation {
  action: AdaptiveAction;
  targetTempo: number;
  targetEnergy: number;
  targetValence: number;
  /** 0–1 confidence in this recommendation given available signal quality. */
  confidence: number;
  reasoning: string;
  flowPrediction: string;
  /** Feature seeds a provider can use to fetch concrete candidate tracks. */
  seeds: {
    tempo: { min: number; max: number };
    energy: { min: number; max: number };
    valence: { min: number; max: number };
    avoidArtists: string[];
    preferArtists: string[];
  };
}

export interface AdaptiveInput {
  activity: Activity;
  sample: BiometricSample;
  /** Recent samples (oldest → newest) used for trend analysis. */
  history?: BiometricSample[];
  currentTrack?: Track;
  preferences?: UserPreferences;
  /** Target the user is steering toward; defaults to `in_flow`. */
  targetFlowState?: FlowState;
}
