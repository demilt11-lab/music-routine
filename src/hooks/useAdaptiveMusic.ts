import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BiometricState {
  heartRate: number;
  stressLevel: number;
  focusScore: number;
  relaxationScore: number;
  flowState: "none" | "entering" | "in-flow" | "exiting";
  eegAlpha?: number;
  eegBeta?: number;
  eegTheta?: number;
  eegGamma?: number;
  eegDelta?: number;
  meditationScore?: number;
}

interface SongRecommendation {
  title: string;
  artist: string;
  tempo: number;
  energy: number;
  reason: string;
}

interface MusicRecommendation {
  action: "increase_tempo" | "decrease_tempo" | "increase_energy" | "decrease_energy" | "maintain" | "change_genre";
  targetTempo: number;
  targetEnergy: number;
  reasoning: string;
  suggestedSongs: SongRecommendation[];
  flowPrediction: string;
}

interface AdaptiveMusicState {
  isEnabled: boolean;
  isLoading: boolean;
  currentRecommendation: MusicRecommendation | null;
  recommendationHistory: MusicRecommendation[];
  lastUpdated: Date | null;
  error: string | null;
}

interface CurrentSong {
  title: string;
  artist: string;
  tempo?: number;
  energy?: number;
}

// Typed user preferences — matches the FeedbackSummary produced by
// useTrackFeedback and the shape the adaptive-music edge function consumes.
interface UserPreferences {
  likedArtists: string[];
  dislikedArtists: string[];
  likedTempoRange: { min: number; max: number } | null;
  dislikedTempoRange: { min: number; max: number } | null;
  likedEnergyRange: { min: number; max: number } | null;
  preferenceDescription: string;
}

export function useAdaptiveMusic(activityType: string = "study") {
  const userPreferencesRef = useRef<UserPreferences | null>(null);
  const [state, setState] = useState<AdaptiveMusicState>({
    isEnabled: false,
    isLoading: false,
    currentRecommendation: null,
    recommendationHistory: [],
    lastUpdated: null,
    error: null,
  });
  const biometricHistory = useRef<BiometricState[]>([]);
  const updateInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastBiometricState = useRef<BiometricState | null>(null);
  const currentSongRef = useRef<CurrentSong | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const fetchRecommendation = useCallback(async (
    biometricState: BiometricState,
    targetFlowState: string = "in-flow"
  ) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (isMountedRef.current) {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
    }
    try {
      const { data, error } = await supabase.functions.invoke("adaptive-music", {
        body: {
          biometricState,
          activityType,
          currentSong: currentSongRef.current,
          targetFlowState,
          recentReadings: biometricHistory.current.slice(-10),
          userPreferences: userPreferencesRef.current ?? undefined,
        },
      });

      if (controller.signal.aborted) return null;

      if (error) {
        throw new Error(error.message);
      }
      if (data?.error) {
        if (data.error.includes("Rate limit")) {
          toast.error("AI rate limit reached. Try again in a moment.");
        } else if (data.error.includes("Payment")) {
          toast.error("AI credits needed. Please add credits to continue.");
        }
        throw new Error(data.error);
      }

      const recommendation = data.recommendation as MusicRecommendation;

      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          currentRecommendation: recommendation,
          recommendationHistory: [recommendation, ...prev.recommendationHistory].slice(0, 20),
          lastUpdated: new Date(),
        }));
      }
      return recommendation;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return null;
      const errorMessage = err instanceof Error ? err.message : "Failed to get recommendation";
      if (isMountedRef.current) {
        setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      }
      return null;
    }
  }, [activityType]);

  const updateBiometrics = useCallback((biometricState: BiometricState) => {
    lastBiometricState.current = biometricState;
    biometricHistory.current = [...biometricHistory.current, biometricState].slice(-50);
  }, []);

  const setCurrentSong = useCallback((song: CurrentSong | null) => {
    currentSongRef.current = song;
  }, []);

  const setUserPreferences = useCallback((preferences: UserPreferences) => {
    userPreferencesRef.current = preferences;
  }, []);

  const enable = useCallback((intervalMs: number = 30000) => {
    setState(prev => ({ ...prev, isEnabled: true }));
    if (updateInterval.current) {
      clearInterval(updateInterval.current);
    }
    updateInterval.current = setInterval(() => {
      if (lastBiometricState.current && biometricHistory.current.length >= 3) {
        fetchRecommendation(lastBiometricState.current);
      }
    }, intervalMs);
    if (lastBiometricState.current) {
      fetchRecommendation(lastBiometricState.current);
    }
  }, [fetchRecommendation]);

  const disable = useCallback(() => {
    setState(prev => ({ ...prev, isEnabled: false }));
    if (updateInterval.current) {
      clearInterval(updateInterval.current);
      updateInterval.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const getImmediateRecommendation = useCallback(async () => {
    if (!lastBiometricState.current) {
      toast.error("No biometric data available yet");
      return null;
    }
    return fetchRecommendation(lastBiometricState.current);
  }, [fetchRecommendation]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    state,
    enable,
    disable,
    updateBiometrics,
    setCurrentSong,
    setUserPreferences,
    getImmediateRecommendation,
    fetchRecommendation,
  };
}
