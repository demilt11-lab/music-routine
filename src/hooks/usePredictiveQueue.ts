import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface PredictedSegment {
  startMinute: number;
  endMinute: number;
  predictedState: {
    focus: number;
    relaxation: number;
    stress: number;
    flow: number;
  };
  recommendedTempo: number;
  recommendedEnergy: number;
  reason: string;
}

interface QueuedTrack {
  id: string;
  title: string;
  artist: string;
  tempo: number;
  energy: number;
  audioUrl?: string;
  source: 'jamendo' | 'local' | 'recommendation';
  reason?: string;
  segment?: number;
}

interface BiometricTrend {
  focusTrend: number; // positive = increasing, negative = decreasing
  stressTrend: number;
  relaxationTrend: number;
  avgHeartRate: number;
}

interface PredictiveQueueState {
  isBuilding: boolean;
  segments: PredictedSegment[];
  predictedQueue: QueuedTrack[];
  totalDuration: number; // minutes
  currentSegment: number;
  biometricTrend: BiometricTrend | null;
}

interface UsePredictiveQueueReturn {
  state: PredictiveQueueState;
  buildQueue: (
    durationMinutes: number,
    activityType: string,
    currentBiometrics: { focus: number; relaxation: number; stress: number; heartRate: number },
    historicalTrend?: BiometricTrend,
    goalFlowScore?: number
  ) => Promise<PredictedSegment[]>;
  addTracksToSegment: (segmentIndex: number, tracks: QueuedTrack[]) => void;
  getSegmentTracks: (segmentIndex: number) => QueuedTrack[];
  advanceSegment: () => void;
  clearQueue: () => void;
  updateBiometricTrend: (trend: BiometricTrend) => void;
  recalculateFromSegment: (segmentIndex: number, currentBiometrics: { focus: number; relaxation: number; stress: number }) => void;
}

// Activity-specific baseline targets
const activityTargets: Record<string, { focus: number; relaxation: number; energy: number; tempo: number }> = {
  study: { focus: 80, relaxation: 50, energy: 0.5, tempo: 100 },
  workout: { focus: 60, relaxation: 30, energy: 0.85, tempo: 140 },
  sleep: { focus: 20, relaxation: 90, energy: 0.2, tempo: 60 },
  relax: { focus: 40, relaxation: 80, energy: 0.35, tempo: 75 },
  meditation: { focus: 70, relaxation: 85, energy: 0.25, tempo: 65 },
  commute: { focus: 50, relaxation: 60, energy: 0.6, tempo: 110 },
};

export function usePredictiveQueue(): UsePredictiveQueueReturn {
  const [state, setState] = useState<PredictiveQueueState>({
    isBuilding: false,
    segments: [],
    predictedQueue: [],
    totalDuration: 30,
    currentSegment: 0,
    biometricTrend: null,
  });

  const segmentDuration = 5; // 5-minute segments

  // Predict biometric state for a future segment based on current state and trends
  const predictSegmentState = useCallback((
    minutesFromNow: number,
    currentState: { focus: number; relaxation: number; stress: number },
    trend: BiometricTrend | null,
    activityType: string,
    goalFlowScore?: number
  ): { focus: number; relaxation: number; stress: number; flow: number } => {
    const target = activityTargets[activityType.toLowerCase()] || activityTargets.study;
    
    // Natural regression toward activity baseline over time
    const regressionFactor = Math.min(minutesFromNow / 30, 0.5); // Max 50% regression
    
    let predictedFocus = currentState.focus;
    let predictedRelaxation = currentState.relaxation;
    let predictedStress = currentState.stress;

    // Apply trends if available
    if (trend) {
      predictedFocus += trend.focusTrend * (minutesFromNow / 5);
      predictedRelaxation += trend.relaxationTrend * (minutesFromNow / 5);
      predictedStress += trend.stressTrend * (minutesFromNow / 5);
    }

    // Natural regression toward baseline
    predictedFocus = predictedFocus + (target.focus - predictedFocus) * regressionFactor;
    predictedRelaxation = predictedRelaxation + (target.relaxation - predictedRelaxation) * regressionFactor;
    
    // Stress tends to creep up over time without intervention
    const stressCreep = minutesFromNow * 0.3; // 0.3% per minute
    predictedStress = Math.min(100, predictedStress + stressCreep);

    // Clamp values
    predictedFocus = Math.max(0, Math.min(100, predictedFocus));
    predictedRelaxation = Math.max(0, Math.min(100, predictedRelaxation));
    predictedStress = Math.max(0, Math.min(100, predictedStress));

    const flow = (predictedFocus + predictedRelaxation) / 2;

    return { focus: predictedFocus, relaxation: predictedRelaxation, stress: predictedStress, flow };
  }, []);

  // Calculate recommended music characteristics for a segment
  const calculateMusicRecommendation = useCallback((
    predictedState: { focus: number; relaxation: number; stress: number; flow: number },
    activityType: string,
    goalFlowScore?: number
  ): { tempo: number; energy: number; reason: string } => {
    const target = activityTargets[activityType.toLowerCase()] || activityTargets.study;
    const goalScore = goalFlowScore || 70;
    
    let tempo = target.tempo;
    let energy = target.energy;
    let reasons: string[] = [];

    // Adjust based on predicted state
    const flowGap = goalScore - predictedState.flow;

    if (predictedState.stress > 60) {
      tempo -= 15;
      energy -= 0.15;
      reasons.push('Calming music to reduce predicted stress');
    }

    if (predictedState.focus < 50 && activityType.toLowerCase() !== 'sleep') {
      tempo += 10;
      energy += 0.1;
      reasons.push('Energizing to boost focus');
    }

    if (flowGap > 20) {
      tempo += 5;
      energy += 0.05;
      reasons.push('Optimizing for flow state');
    } else if (flowGap < -10) {
      tempo -= 5;
      energy -= 0.05;
      reasons.push('Maintaining flow state');
    }

    // Clamp values
    tempo = Math.max(60, Math.min(160, tempo));
    energy = Math.max(0.1, Math.min(1, energy));

    return {
      tempo: Math.round(tempo),
      energy: Math.round(energy * 100) / 100,
      reason: reasons.length > 0 ? reasons.join('. ') : 'Baseline activity music',
    };
  }, []);

  // Build the predictive queue for the specified duration
  const buildQueue = useCallback(async (
    durationMinutes: number,
    activityType: string,
    currentBiometrics: { focus: number; relaxation: number; stress: number; heartRate: number },
    historicalTrend?: BiometricTrend,
    goalFlowScore?: number
  ): Promise<PredictedSegment[]> => {
    setState(prev => ({ ...prev, isBuilding: true }));

    try {
      const numSegments = Math.ceil(durationMinutes / segmentDuration);
      const segments: PredictedSegment[] = [];

      for (let i = 0; i < numSegments; i++) {
        const startMinute = i * segmentDuration;
        const endMinute = Math.min((i + 1) * segmentDuration, durationMinutes);
        const midpointMinute = (startMinute + endMinute) / 2;

        const predictedState = predictSegmentState(
          midpointMinute,
          currentBiometrics,
          historicalTrend || null,
          activityType,
          goalFlowScore
        );

        const musicRec = calculateMusicRecommendation(predictedState, activityType, goalFlowScore);

        segments.push({
          startMinute,
          endMinute,
          predictedState: {
            focus: Math.round(predictedState.focus),
            relaxation: Math.round(predictedState.relaxation),
            stress: Math.round(predictedState.stress),
            flow: Math.round(predictedState.flow),
          },
          recommendedTempo: musicRec.tempo,
          recommendedEnergy: musicRec.energy,
          reason: musicRec.reason,
        });
      }

      setState(prev => ({
        ...prev,
        isBuilding: false,
        segments,
        totalDuration: durationMinutes,
        currentSegment: 0,
        biometricTrend: historicalTrend || null,
      }));

      toast.success(`Built ${numSegments} segments for ${durationMinutes}-minute session`);
      return segments;

    } catch (error) {
      console.error('Error building predictive queue:', error);
      toast.error('Failed to build predictive queue');
      setState(prev => ({ ...prev, isBuilding: false }));
      return [];
    }
  }, [predictSegmentState, calculateMusicRecommendation]);

  // Add tracks to a specific segment
  const addTracksToSegment = useCallback((segmentIndex: number, tracks: QueuedTrack[]) => {
    const tracksWithSegment = tracks.map(t => ({ ...t, segment: segmentIndex }));
    setState(prev => ({
      ...prev,
      predictedQueue: [...prev.predictedQueue, ...tracksWithSegment],
    }));
  }, []);

  // Get tracks for a specific segment
  const getSegmentTracks = useCallback((segmentIndex: number): QueuedTrack[] => {
    return state.predictedQueue.filter(t => t.segment === segmentIndex);
  }, [state.predictedQueue]);

  // Advance to next segment
  const advanceSegment = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentSegment: Math.min(prev.currentSegment + 1, prev.segments.length - 1),
    }));
  }, []);

  // Clear the queue
  const clearQueue = useCallback(() => {
    setState({
      isBuilding: false,
      segments: [],
      predictedQueue: [],
      totalDuration: 30,
      currentSegment: 0,
      biometricTrend: null,
    });
  }, []);

  // Update biometric trend data
  const updateBiometricTrend = useCallback((trend: BiometricTrend) => {
    setState(prev => ({ ...prev, biometricTrend: trend }));
  }, []);

  // Recalculate remaining segments from a given point
  const recalculateFromSegment = useCallback((
    segmentIndex: number,
    currentBiometrics: { focus: number; relaxation: number; stress: number }
  ) => {
    setState(prev => {
      if (segmentIndex >= prev.segments.length) return prev;

      const activityType = 'study'; // Would need to pass this in
      const updatedSegments = [...prev.segments];

      for (let i = segmentIndex; i < updatedSegments.length; i++) {
        const minutesFromNow = (i - segmentIndex) * segmentDuration;
        const predictedState = predictSegmentState(
          minutesFromNow,
          currentBiometrics,
          prev.biometricTrend,
          activityType
        );

        const musicRec = calculateMusicRecommendation(predictedState, activityType);

        updatedSegments[i] = {
          ...updatedSegments[i],
          predictedState: {
            focus: Math.round(predictedState.focus),
            relaxation: Math.round(predictedState.relaxation),
            stress: Math.round(predictedState.stress),
            flow: Math.round(predictedState.flow),
          },
          recommendedTempo: musicRec.tempo,
          recommendedEnergy: musicRec.energy,
          reason: musicRec.reason,
        };
      }

      return { ...prev, segments: updatedSegments };
    });
  }, [predictSegmentState, calculateMusicRecommendation]);

  return {
    state,
    buildQueue,
    addTracksToSegment,
    getSegmentTracks,
    advanceSegment,
    clearQueue,
    updateBiometricTrend,
    recalculateFromSegment,
  };
}
