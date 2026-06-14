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
  // Confidence tier for UI display
  confidence: "high" | "medium" | "low" | "simulated";
  signalQuality?: number; // 0-100
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
  // Baseline computed from first 30 seconds for z-score normalization
  sessionBaseline: {
    focus: number;
    relaxation: number;
    stress: number;
  } | null;
  sessionSource: "real" | "simulated";
  // Null-tick tracking
  dataGap: boolean;         // true after 10 consecutive ticks with no real reading
  fallbackMode: boolean;    // true after 30 consecutive null ticks — classifier runs on last valid
  consecutiveNullTicks: number;
  lastRealReading: BiometricReading | null; // last reading from a real device (not simulated)
}

interface UseBiometricTrackingReturn {
  state: BiometricState;
  startTracking: (sessionId?: string) => void;
  stopTracking: () => void;
  addReading: (reading: Partial<BiometricReading>) => void;
  saveReadingsToSession: (sessionId: string) => Promise<boolean>;
  simulateBiometrics: (songEnergy?: number, songTempo?: number) => void;
}

// Validate HR is physiologically plausible
function isValidHeartRate(hr: number): boolean {
  return hr >= 35 && hr <= 210;
}

function isValidHRV(hrv: number): boolean {
  return hrv > 0 && hrv <= 300;
}

// SpO2 < 70 or > 100 is a sensor artifact — flag, don't reject outright
function spO2ArtifactFlag(spO2: number): boolean {
  return spO2 < 70 || spO2 > 100;
}

// EEG relative band powers should sum to ~1.0 (±0.15 tolerance)
// Absolute raw values (e.g., 20, 30) are rejected as un-normalized artifact
function eegSumArtifact(alpha?: number, beta?: number, theta?: number, gamma?: number, delta?: number): boolean {
  const defined = [alpha, beta, theta, gamma, delta].filter((v): v is number => v !== undefined);
  if (defined.length === 0) return false;
  const sum = defined.reduce((a, b) => a + b, 0);
  // All-zero: disconnected sensor
  if (sum === 0) return true;
  // If any single band > 5.0, these are absolute powers, not relative
  if (defined.some((v) => v > 5.0)) return true;
  // Sum should be within ±0.15 of 1.0 when all 5 bands present
  if (defined.length === 5 && (sum < 0.85 || sum > 1.15)) return true;
  return false;
}

// Simulate biometric responses based on music characteristics
function simulateReading(songEnergy = 0.5, songTempo = 120): BiometricReading {
  const baseHeartRate    = 70;
  const tempoInfluence   = (songTempo - 100) * 0.3;
  const energyInfluence  = songEnergy * 30;

  const heartRate       = Math.round(baseHeartRate + tempoInfluence + energyInfluence + (Math.random() * 10 - 5));
  const hrv             = Math.round(50 - (songEnergy * 20) + (Math.random() * 10));
  const relaxationScore = Math.max(0, Math.min(100, 80 - (songEnergy * 60) + (Math.random() * 10)));
  const focusScore      = Math.max(0, Math.min(100, 40 + (songEnergy * 40) + (Math.random() * 15)));
  const stressLevel     = Math.max(0, Math.min(100, 30 + (songEnergy * 30) - relaxationScore * 0.3 + (Math.random() * 10)));

  return {
    heartRate:             Math.max(50, Math.min(180, heartRate)),
    heartRateVariability:  Math.max(10, hrv),
    stressLevel:           Math.round(stressLevel),
    relaxationScore:       Math.round(relaxationScore),
    focusScore:            Math.round(focusScore),
    eegAlpha:              8  + Math.random() * 4,
    eegBeta:               12 + Math.random() * 6 + (songEnergy * 5),
    eegTheta:              4  + Math.random() * 2 + (relaxationScore / 20),
    eegGamma:              25 + Math.random() * 10,
    eegDelta:              0.5 + Math.random() * 2,
    deviceType:  "simulated",
    recordedAt:  new Date(),
    confidence:  "simulated",
    signalQuality: 100,
  };
}

function calculateFlowState(readings: BiometricReading[]): BiometricState["flowState"] {
  if (readings.length < 5) return "none";

  const recent     = readings.slice(-10);
  const avgFocus   = recent.reduce((s, r) => s + r.focusScore, 0)      / recent.length;
  const avgRelax   = recent.reduce((s, r) => s + r.relaxationScore, 0) / recent.length;
  const avgStress  = recent.reduce((s, r) => s + r.stressLevel, 0)     / recent.length;

  const flowScore = avgFocus * 0.5 + avgRelax * 0.3 - avgStress * 0.2;

  if (flowScore > 60) return "in-flow";
  if (flowScore > 45) return "entering";
  if (flowScore > 30) return "exiting";
  return "none";
}

// Compute z-score normalized baseline from calibration window (first N readings)
function computeBaseline(readings: BiometricReading[]) {
  if (readings.length === 0) return null;
  const n   = readings.length;
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  return {
    focus:      avg(readings.map(r => r.focusScore)),
    relaxation: avg(readings.map(r => r.relaxationScore)),
    stress:     avg(readings.map(r => r.stressLevel)),
  };
}

// Calibration window: 15 readings = ~30 seconds at 2s interval
const BASELINE_READINGS = 15;

export function useBiometricTracking(): UseBiometricTrackingReturn {
  const [state, setState] = useState<BiometricState>({
    isTracking:           false,
    currentReading:       null,
    readings:             [],
    averages:             { heartRate: 0, stressLevel: 0, relaxationScore: 0, focusScore: 0 },
    flowState:            "none",
    sessionBaseline:      null,
    sessionSource:        "simulated",
    dataGap:              false,
    fallbackMode:         false,
    consecutiveNullTicks: 0,
    lastRealReading:      null,
  });

  const trackingInterval   = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentSessionId   = useRef<string | null>(null);

  const updateAverages = useCallback((readings: BiometricReading[]) => {
    if (readings.length === 0)
      return { heartRate: 0, stressLevel: 0, relaxationScore: 0, focusScore: 0 };

    const sum = readings.reduce(
      (acc, r) => ({
        heartRate:      acc.heartRate      + r.heartRate,
        stressLevel:    acc.stressLevel    + r.stressLevel,
        relaxationScore: acc.relaxationScore + r.relaxationScore,
        focusScore:     acc.focusScore     + r.focusScore,
      }),
      { heartRate: 0, stressLevel: 0, relaxationScore: 0, focusScore: 0 }
    );

    return {
      heartRate:       Math.round(sum.heartRate       / readings.length),
      stressLevel:     Math.round(sum.stressLevel     / readings.length),
      relaxationScore: Math.round(sum.relaxationScore / readings.length),
      focusScore:      Math.round(sum.focusScore      / readings.length),
    };
  }, []);

  const addReading = useCallback((partialReading: Partial<BiometricReading>) => {
    // Validate HR if provided
    if (partialReading.heartRate !== undefined && !isValidHeartRate(partialReading.heartRate)) {
      console.warn("Rejected out-of-range HR reading:", partialReading.heartRate);
      return;
    }

    // Validate HRV — zero and negative values are non-physiological
    if (partialReading.heartRateVariability !== undefined && !isValidHRV(partialReading.heartRateVariability)) {
      console.warn("Rejected invalid HRV reading:", partialReading.heartRateVariability);
      return;
    }

    const isSimulated = partialReading.deviceType === "simulated" || partialReading.confidence === "simulated";
    const isReal      = partialReading.deviceType && !isSimulated;

    // Detect SpO2 artifact (< 70 or > 100) — flag confidence as low, do NOT reject
    const bloodOxygen = (partialReading as any).bloodOxygen as number | undefined;
    const spO2Artifact = !isSimulated && bloodOxygen !== undefined && spO2ArtifactFlag(bloodOxygen);

    // Detect EEG artifact (un-normalized absolute powers or all-zero) — skip for simulated readings
    const eegArtifact = !isSimulated && eegSumArtifact(
      partialReading.eegAlpha,
      partialReading.eegBeta,
      partialReading.eegTheta,
      partialReading.eegGamma,
      partialReading.eegDelta,
    );

    const isArtifact = spO2Artifact || eegArtifact;

    const confidence: BiometricReading["confidence"] =
      partialReading.confidence ??
      (isArtifact ? "low" : isReal ? "medium" : "simulated");

    const reading: BiometricReading = {
      heartRate:            partialReading.heartRate            ?? 70,
      heartRateVariability: partialReading.heartRateVariability ?? 50,
      stressLevel:          partialReading.stressLevel          ?? 30,
      relaxationScore:      partialReading.relaxationScore      ?? 50,
      focusScore:           partialReading.focusScore           ?? 50,
      deviceType:           partialReading.deviceType           ?? "manual",
      recordedAt:           partialReading.recordedAt           ?? new Date(),
      confidence,
      signalQuality:        isArtifact ? 0 : (partialReading.signalQuality ?? 100),
      ...partialReading,
      // confidence and signalQuality must not be overridden by spread when artifact
      ...(isArtifact ? { confidence: "low" as const, signalQuality: 0 } : {}),
    };

    setState((prev) => {
      const newReadings = [...prev.readings, reading];

      // Compute baseline from first BASELINE_READINGS readings
      const baseline =
        prev.sessionBaseline ??
        (newReadings.length >= BASELINE_READINGS
          ? computeBaseline(newReadings.slice(0, BASELINE_READINGS))
          : null);

      const sessionSource: BiometricState["sessionSource"] =
        newReadings.some(r => r.deviceType !== "simulated") ? "real" : "simulated";

      const lastRealReading = isSimulated ? prev.lastRealReading : reading;

      // In fallback mode, simulated readings don't replace the frozen last-real-device
      // reading — that is what the classifier receives as its input.
      const currentReading =
        prev.fallbackMode && isSimulated
          ? (prev.lastRealReading
              ? { ...prev.lastRealReading, confidence: "low" as const }
              : prev.currentReading)
          : reading;

      return {
        ...prev,
        currentReading,
        lastRealReading,
        readings:             newReadings,
        averages:             updateAverages(newReadings),
        flowState:            calculateFlowState(newReadings),
        sessionBaseline:      baseline,
        sessionSource,
        // Only real-device readings reset the null-tick counter
        consecutiveNullTicks: isSimulated ? prev.consecutiveNullTicks : 0,
        dataGap:              isSimulated ? prev.dataGap : false,
        fallbackMode:         isSimulated ? prev.fallbackMode : false,
      };
    });
  }, [updateAverages]);

  const simulateBiometrics = useCallback((songEnergy = 0.5, songTempo = 120) => {
    addReading(simulateReading(songEnergy, songTempo));
  }, [addReading]);

  const DATA_GAP_TICKS    = 10; // ~20s at 2s interval
  const FALLBACK_TICKS    = 30; // ~60s

  const startTracking = useCallback((sessionId?: string) => {
    if (sessionId) currentSessionId.current = sessionId;
    setState((prev) => ({
      ...prev,
      isTracking:           true,
      readings:             [],
      currentReading:       null,
      lastRealReading:      null,
      sessionBaseline:      null,
      sessionSource:        "simulated",
      consecutiveNullTicks: 0,
      dataGap:              false,
      fallbackMode:         false,
    }));
    trackingInterval.current = setInterval(() => {
      // Advance null-tick counter first (addReading from a real device resets it)
      setState((prev) => {
        if (!prev.isTracking) return prev;
        const nullTicks = prev.consecutiveNullTicks + 1;
        const dataGap    = nullTicks >= DATA_GAP_TICKS;
        const fallback   = nullTicks >= FALLBACK_TICKS;

        // In fallback mode, freeze currentReading at last known real reading
        // and downgrade its confidence to "low" to signal staleness
        const currentReading =
          fallback && prev.currentReading
            ? { ...prev.currentReading, confidence: "low" as const }
            : prev.currentReading;

        return {
          ...prev,
          consecutiveNullTicks: nullTicks,
          dataGap,
          fallbackMode: fallback,
          currentReading,
        };
      });

      // Generate a simulated reading only when NOT in fallback mode
      // (in fallback mode the last valid reading is frozen as the classifier input)
      setState((prev) => {
        if (prev.fallbackMode) return prev;
        return prev; // simulateBiometrics call below handles the actual reading
      });
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
      user_id:               user.id,
      session_id:            sessionId,
      heart_rate:            r.heartRate,
      heart_rate_variability: r.heartRateVariability,
      stress_level:          r.stressLevel,
      relaxation_score:      r.relaxationScore,
      focus_score:           r.focusScore,
      eeg_alpha:             r.eegAlpha,
      eeg_beta:              r.eegBeta,
      eeg_theta:             r.eegTheta,
      eeg_gamma:             r.eegGamma,
      eeg_delta:             r.eegDelta,
      device_type:           r.deviceType,
      confidence:            r.confidence,
      signal_quality:        r.signalQuality,
      recorded_at:           r.recordedAt.toISOString(),
    }));

    const { error } = await supabase
      .from("biometric_readings")
      .insert(readingsToSave);

    if (error) console.error("Failed to save biometric readings:", error);
    return !error;
  }, [state.readings]);

  useEffect(() => {
    return () => {
      if (trackingInterval.current) clearInterval(trackingInterval.current);
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
