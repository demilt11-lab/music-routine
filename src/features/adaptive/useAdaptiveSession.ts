import { useCallback, useEffect, useRef, useState } from "react";
import type { Activity, AdaptiveRecommendation, BiometricSample, Track } from "@biomusic/core";
import { adaptiveClient } from "@/lib/adaptive-client";

const REFRESH_MS = 15_000;

interface Options {
  activity: Activity;
  sessionId?: string;
  sample: BiometricSample | null;
  history: BiometricSample[];
  currentTrack?: Track;
  enabled: boolean;
}

export interface AdaptiveSessionState {
  recommendation: AdaptiveRecommendation | null;
  candidates: Track[];
  loading: boolean;
  /** True when the last recommendation was computed locally (service offline). */
  local: boolean;
  refresh: () => void;
}

/**
 * Drives the recommendation loop: it asks the adaptive service for a fresh
 * recommendation on a fixed cadence (and on demand). Requests are guarded so a
 * slow response can never overlap or stack up.
 */
export function useAdaptiveSession({
  activity,
  sessionId,
  sample,
  history,
  currentTrack,
  enabled,
}: Options): AdaptiveSessionState {
  const [recommendation, setRecommendation] = useState<AdaptiveRecommendation | null>(null);
  const [candidates, setCandidates] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [local, setLocal] = useState(false);
  const inFlight = useRef(false);
  const latest = useRef({ sample, history, currentTrack, activity });
  latest.current = { sample, history, currentTrack, activity };

  const refresh = useCallback(async () => {
    const snap = latest.current;
    if (!snap.sample || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const result = await adaptiveClient.next({
        sessionId,
        activity: snap.activity,
        sample: snap.sample,
        history: snap.history.slice(-30),
        currentTrack: snap.currentTrack,
        enrich: true,
      });
      setRecommendation(result.recommendation);
      setCandidates(result.candidates);
      setLocal(result.local);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!enabled) return;
    if (sample && !recommendation) void refresh(); // first reading
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [enabled, sample, recommendation, refresh]);

  return { recommendation, candidates, loading, local, refresh };
}
