import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BiometricReading {
  heartRate: number;
  heartRateVariability: number;
  stressLevel: number;
  relaxationScore: number;
  focusScore: number;
  eegAlpha?: number;
  eegBeta?: number;
  eegTheta?: number;
  eegGamma?: number;
  eegDelta?: number;
  deviceType: string;
  recordedAt: Date;
}

export interface BiometricState {
  isTracking: boolean;
  currentReading: BiometricReading | null;
  readings: BiometricReading[];
  averages: {
    heartRate: number;
    stressLevel: number;
    relaxationScore: number;
    focusScore: number;
  };
  flowState: "none" | "entering" | "in-flow" | "exiting";
}

interface UseBiometricTrackingReturn {
  state: BiometricState;
  startTracking: (sessionId?: string) => void;
  stopTracking: () => void;
  addReading: (reading: Partial<BiometricReading>) => void;
  saveReadingsToSession: (sessionId: string) => Promise<boolean>;
  simulateBiometrics: (songEnergy?: number, songTempo?: number) => void;
}

// Simulate biometric responses based on music characteristics
function simulateReading(songEnergy = 0.5, songTempo = 120): BiometricReading {
  const baseHeartRate = 70;
  const tempoInfluence = (songTempo - 100) * 0.3;
  const energyInfluence = songEnergy * 30;
  
  const heartRate = Math.round(baseHeartRate + tempoInfluence + energyInfluence + (Math.random() * 10 - 5));
  const hrv = Math.round(50 - (songEnergy * 20) + (Math.random() * 10));
  
  // Higher energy music = lower relaxation, higher focus (up to a point)
  const relaxationScore = Math.max(0, Math.min(100, 80 - (songEnergy * 60) + (Math.random() * 10)));
  const focusScore = Math.max(0, Math.min(100, 40 + (songEnergy * 40) + (Math.random() * 15)));
  const stressLevel = Math.max(0, Math.min(100, 30 + (songEnergy * 30) - relaxationScore * 0.3 + (Math.random() * 10)));
  
  return {
    heartRate: Math.max(50, Math.min(180, heartRate)),
    heartRateVariability: Math.max(10, hrv),
    stressLevel: Math.round(stressLevel),
    relaxationScore: Math.round(relaxationScore),
    focusScore: Math.round(focusScore),
    eegAlpha: 8 + Math.random() * 4,
    eegBeta: 12 + Math.random() * 6 + (songEnergy * 5),
    eegTheta: 4 + Math.random() * 2 + (relaxationScore / 20),
    eegGamma: 25 + Math.random() * 10,
    eegDelta: 0.5 + Math.random() * 2,
    deviceType: "simulated",
    recordedAt: new Date(),
  };
}

function calculateFlowState(readings: BiometricReading[]): BiometricState["flowState"] {
  if (readings.length < 5) return "none";
  
  const recent = readings.slice(-10);
  const avgFocus = recent.reduce((sum, r) => sum + r.focusScore, 0) / recent.length;
  const avgRelaxation = recent.reduce((sum, r) => sum + r.relaxationScore, 0) / recent.length;
  const avgStress = recent.reduce((sum, r) => sum + r.stressLevel, 0) / recent.length;
  
  // Flow state: high focus, moderate relaxation, low stress
  const flowScore = avgFocus * 0.5 + avgRelaxation * 0.3 - avgStress * 0.2;
  
  if (flowScore > 60) return "in-flow";
  if (flowScore > 45) return "entering";
  if (flowScore > 30) return "exiting";
  return "none";
}

export function useBiometricTracking(): UseBiometricTrackingReturn {
  const [state, setState] = useState<BiometricState>({
    isTracking: false,
    currentReading: null,
    readings: [],
    averages: { heartRate: 0, stressLevel: 0, relaxationScore: 0, focusScore: 0 },
    flowState: "none",
  });
  
  const trackingInterval = useRef<NodeJS.Timeout | null>(null);
  const currentSessionId = useRef<string | null>(null);

  const updateAverages = useCallback((readings: BiometricReading[]) => {
    if (readings.length === 0) {
      return { heartRate: 0, stressLevel: 0, relaxationScore: 0, focusScore: 0 };
    }
    
    const sum = readings.reduce(
      (acc, r) => ({
        heartRate: acc.heartRate + r.heartRate,
        stressLevel: acc.stressLevel + r.stressLevel,
        relaxationScore: acc.relaxationScore + r.relaxationScore,
        focusScore: acc.focusScore + r.focusScore,
      }),
      { heartRate: 0, stressLevel: 0, relaxationScore: 0, focusScore: 0 }
    );
    
    return {
      heartRate: Math.round(sum.heartRate / readings.length),
      stressLevel: Math.round(sum.stressLevel / readings.length),
      relaxationScore: Math.round(sum.relaxationScore / readings.length),
      focusScore: Math.round(sum.focusScore / readings.length),
    };
  }, []);

  const addReading = useCallback((partialReading: Partial<BiometricReading>) => {
    const reading: BiometricReading = {
      heartRate: partialReading.heartRate ?? 70,
      heartRateVariability: partialReading.heartRateVariability ?? 50,
      stressLevel: partialReading.stressLevel ?? 30,
      relaxationScore: partialReading.relaxationScore ?? 50,
      focusScore: partialReading.focusScore ?? 50,
      deviceType: partialReading.deviceType ?? "manual",
      recordedAt: partialReading.recordedAt ?? new Date(),
      ...partialReading,
    };

    setState((prev) => {
      const newReadings = [...prev.readings, reading];
      return {
        ...prev,
        currentReading: reading,
        readings: newReadings,
        averages: updateAverages(newReadings),
        flowState: calculateFlowState(newReadings),
      };
    });
  }, [updateAverages]);

  const simulateBiometrics = useCallback((songEnergy = 0.5, songTempo = 120) => {
    const reading = simulateReading(songEnergy, songTempo);
    addReading(reading);
  }, [addReading]);

  const startTracking = useCallback((sessionId?: string) => {
    if (sessionId) {
      currentSessionId.current = sessionId;
    }
    
    setState((prev) => ({ ...prev, isTracking: true, readings: [] }));
    
    // Simulate readings every 2 seconds
    trackingInterval.current = setInterval(() => {
      simulateBiometrics();
    }, 2000);
  }, [simulateBiometrics]);

  const stopTracking = useCallback(() => {
    if (trackingInterval.current) {
      clearInterval(trackingInterval.current);
      trackingInterval.current = null;
    }
    setState((prev) => ({ ...prev, isTracking: false }));
  }, []);

  const saveReadingsToSession = useCallback(async (sessionId: string): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const readingsToSave = state.readings.map((r) => ({
      user_id: user.id,
      session_id: sessionId,
      heart_rate: r.heartRate,
      heart_rate_variability: r.heartRateVariability,
      stress_level: r.stressLevel,
      relaxation_score: r.relaxationScore,
      focus_score: r.focusScore,
      eeg_alpha: r.eegAlpha,
      eeg_beta: r.eegBeta,
      eeg_theta: r.eegTheta,
      eeg_gamma: r.eegGamma,
      eeg_delta: r.eegDelta,
      device_type: r.deviceType,
      recorded_at: r.recordedAt.toISOString(),
    }));

    const { error } = await supabase
      .from("biometric_readings")
      .insert(readingsToSave);

    if (error) {
      console.error("Failed to save biometric readings:", error);
    }
    return !error;
  }, [state.readings]);

  useEffect(() => {
    return () => {
      if (trackingInterval.current) {
        clearInterval(trackingInterval.current);
      }
    };
  }, []);

  return {
    state,
    startTracking,
    stopTracking,
    addReading,
    saveReadingsToSession,
    simulateBiometrics,
  };
}
