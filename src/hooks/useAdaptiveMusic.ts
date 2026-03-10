import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BiometricState {
  heartRate: number;
  stressLevel: number;
  focusScore: number;
  relaxationScore: number;
  flowState: "none" | "entering" | "in-flow" | "exiting";
  // EEG data (optional)
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

export function useAdaptiveMusic(activityType: string = "study") {
  const userPreferencesRef = useRef<any>(null);
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

  const fetchRecommendation = useCallback(async (
    biometricState: BiometricState,
    targetFlowState: string = "in-flow"
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke("adaptive-music", {
        body: {
          biometricState,
          activityType,
          currentSong: currentSongRef.current,
          targetFlowState,
          recentReadings: biometricHistory.current.slice(-10),
          userPreferences: userPreferencesRef.current || undefined,
        },
      });

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
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        currentRecommendation: recommendation,
        recommendationHistory: [recommendation, ...prev.recommendationHistory].slice(0, 20),
        lastUpdated: new Date(),
      }));

      return recommendation;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to get recommendation";
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
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

  const setUserPreferences = useCallback((preferences: any) => {
    userPreferencesRef.current = preferences;
  }, []);

  const enable = useCallback((intervalMs: number = 30000) => {
    setState(prev => ({ ...prev, isEnabled: true }));

    // Clear any existing interval
    if (updateInterval.current) {
      clearInterval(updateInterval.current);
    }

    // Set up periodic recommendation updates
    updateInterval.current = setInterval(() => {
      if (lastBiometricState.current && biometricHistory.current.length >= 3) {
        fetchRecommendation(lastBiometricState.current);
      }
    }, intervalMs);

    // Get initial recommendation if we have data
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
  }, []);

  const getImmediateRecommendation = useCallback(async () => {
    if (!lastBiometricState.current) {
      toast.error("No biometric data available yet");
      return null;
    }
    return fetchRecommendation(lastBiometricState.current);
  }, [fetchRecommendation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
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
