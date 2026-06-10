import { useState, useCallback, useRef } from 'react';
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
  focusTrend: number;
  stressTrend: number;
  relaxationTrend: number;
  avgHeartRate: number;
}

interface PredictiveQueueState {
  isBuilding: boolean;
  segments: PredictedSegment[];
  predictedQueue: QueuedTrack[];
  totalDuration: number;
  currentSegment: number;
  biometricTrend: BiometricTrend | null;
  // FIX BUG-001: store activityType so recalculateFromSegment uses it
  activityType: string;
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
  study:      { focus: 80, relaxation: 50, energy: 0.50, tempo: 100 },
  workout:    { focus: 60, relaxation: 30, energy: 0.85, tempo: 140 },
  sleep:      { focus: 20, relaxation: 90, energy: 0.20, tempo:  60 },
  relax:      { focus: 40, relaxation: 80, energy: 0.35, tempo:  75 },
  meditation: { focus: 70, relaxation: 85, energy: 0.25, tempo:  65 },
  commute:    { focus: 50, relaxation: 60, energy: 0.60, tempo: 110 },
};

// FIX BUG-002: Activities where stress naturally DECAYS (opposite of creep)
const stressDecayActivities = new Set(['sleep', 'relax', 'meditation']);
// Activities where mild stress creep is physiologically expected
const stressCreepActivities = new Set(['workout', 'commute', 'study']);

export function usePredictiveQueue(): UsePredictiveQueueReturn {
  const [state, setState] = useState<PredictiveQueueState>({
    isBuilding: false,
    segments: [],
    predictedQueue: [],
    totalDuration: 30,
    currentSegment: 0,
    biometricTrend: null,
    activityType: 'study',
  });

  const segmentDuration = 5;

  const predictSegmentState = useCallback((
    minutesFromNow: number,
    currentState: { focus: number; relaxation: number; stress: number },
    trend: BiometricTrend | null,
    activityType: string,
    goalFlowScore?: number
  ): { focus: number; relaxation: number; stress: number; flow: number } => {
    const key = activityType.toLowerCase();
    const target = activityTargets[key] ?? activityTargets.study;
    const regressionFactor = Math.min(minutesFromNow / 30, 0.5);

    let predictedFocus = currentState.focus;
    let predictedRelaxation = currentState.relaxation;
    let predictedStress = currentState.stress;

    if (trend) {
      predictedFocus      += trend.focusTrend      * (minutesFromNow / 5);
      predictedRelaxation += trend.relaxationTrend * (minutesFromNow / 5);
      predictedStress     += trend.stressTrend     * (minutesFromNow / 5);
    }

    // Natural regression toward activity baseline
    predictedFocus      = predictedFocus      + (target.focus      - predictedFocus)      * regressionFactor;
    predictedRelaxation = predictedRelaxation + (target.relaxation - predictedRelaxation) * regressionFactor;

    // FIX BUG-002: Activity-aware stress model
    if (stressDecayActivities.has(key)) {
      // Sleep / relax / meditation: stress decays toward a low baseline
      const stressDecay = minutesFromNow * 0.4;
      predictedStress = Math.max(5, predictedStress - stressDecay);
    } else if (stressCreepActivities.has(key)) {
      // Workout / commute / study: mild creep, capped at 60
      const stressCreep = minutesFromNow * 0.2;
      predictedStress = Math.min(60, predictedStress + stressCreep);
    }
    // else: neutral — no model adjustment, trend drives it

    predictedFocus      = Math.max(0, Math.min(100, predictedFocus));
    predictedRelaxation = Math.max(0, Math.min(100, predictedRelaxation));
    predictedStress     = Math.max(0, Math.min(100, predictedStress));

    const flow = (predictedFocus + predictedRelaxation) / 2;
    return { focus: predictedFocus, relaxation: predictedRelaxation, stress: predictedStress, flow };
  }, []);

  const calculateMusicRecommendation = useCallback((
    predictedState: { focus: number; relaxation: number; stress: number; flow: number },
    activityType: string,
    goalFlowScore?: number
  ): { tempo: number; energy: number; reason: string } => {
    const key = activityType.toLowerCase();
    const target = activityTargets[key] ?? activityTargets.study;
    const goalScore = goalFlowScore ?? 70;

    let tempo = target.tempo;
    let energy = target.energy;
    const reasons: string[] = [];

    const flowGap = goalScore - predictedState.flow;

    if (predictedState.stress > 60) {
      tempo  -= 15;
      energy -= 0.15;
      reasons.push('Calming music to reduce predicted stress');
    }

    if (predictedState.focus < 50 && key !== 'sleep') {
      tempo  += 10;
      energy += 0.1;
      reasons.push('Energizing to boost focus');
    }

    if (flowGap > 20) {
      tempo  += 5;
      energy += 0.05;
      reasons.push('Optimizing for flow state');
    } else if (flowGap < -10) {
      tempo  -= 5;
      energy -= 0.05;
      reasons.push('Maintaining flow state');
    }

    tempo  = Math.max(60,  Math.min(160, tempo));
    energy = Math.max(0.1, Math.min(1,   energy));

    return {
      tempo:  Math.round(tempo),
      energy: Math.round(energy * 100) / 100,
      reason: reasons.length > 0 ? reasons.join('. ') : 'Baseline activity music',
    };
  }, []);

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
        const startMinute   = i * segmentDuration;
        const endMinute     = Math.min((i + 1) * segmentDuration, durationMinutes);
        const midpointMinute = (startMinute + endMinute) / 2;

        const predictedState = predictSegmentState(
          midpointMinute,
          currentBiometrics,
          historicalTrend ?? null,
          activityType,
          goalFlowScore
        );

        const musicRec = calculateMusicRecommendation(predictedState, activityType, goalFlowScore);

        segments.push({
          startMinute,
          endMinute,
          predictedState: {
            focus:      Math.round(predictedState.focus),
            relaxation: Math.round(predictedState.relaxation),
            stress:     Math.round(predictedState.stress),
            flow:       Math.round(predictedState.flow),
          },
          recommendedTempo:  musicRec.tempo,
          recommendedEnergy: musicRec.energy,
          reason:            musicRec.reason,
        });
      }

      // FIX BUG-001: persist activityType in state
      setState(prev => ({
        ...prev,
        isBuilding: false,
        segments,
        totalDuration: durationMinutes,
        currentSegment: 0,
        biometricTrend: historicalTrend ?? null,
        activityType,
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

  const addTracksToSegment = useCallback((segmentIndex: number, tracks: QueuedTrack[]) => {
    const tracksWithSegment = tracks.map(t => ({ ...t, segment: segmentIndex }));
    setState(prev => ({
      ...prev,
      predictedQueue: [...prev.predictedQueue, ...tracksWithSegment],
    }));
  }, []);

  const getSegmentTracks = useCallback((segmentIndex: number): QueuedTrack[] => {
    return state.predictedQueue.filter(t => t.segment === segmentIndex);
  }, [state.predictedQueue]);

  const advanceSegment = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentSegment: Math.min(prev.currentSegment + 1, prev.segments.length - 1),
    }));
  }, []);

  const clearQueue = useCallback(() => {
    setState({
      isBuilding: false,
      segments: [],
      predictedQueue: [],
      totalDuration: 30,
      currentSegment: 0,
      biometricTrend: null,
      activityType: 'study',
    });
  }, []);

  const updateBiometricTrend = useCallback((trend: BiometricTrend) => {
    setState(prev => ({ ...prev, biometricTrend: trend }));
  }, []);

  // FIX BUG-001: uses activityType from state instead of hardcoded 'study'
  const recalculateFromSegment = useCallback((
    segmentIndex: number,
    currentBiometrics: { focus: number; relaxation: number; stress: number }
  ) => {
    setState(prev => {
      if (segmentIndex >= prev.segments.length) return prev;

      // Use stored activity type — no longer hardcoded
      const activityType = prev.activityType;
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
            focus:      Math.round(predictedState.focus),
            relaxation: Math.round(predictedState.relaxation),
            stress:     Math.round(predictedState.stress),
            flow:       Math.round(predictedState.flow),
          },
          recommendedTempo:  musicRec.tempo,
          recommendedEnergy: musicRec.energy,
          reason:            musicRec.reason,
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
