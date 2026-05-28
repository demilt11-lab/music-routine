import { useCallback, useEffect, useRef, useState } from "react";
import type { Activity, AdaptiveRecommendation, BiometricSample, Track } from "@biomusic/core";
import { adaptiveClient } from "@/lib/adaptive-client";

const REFRESH_MS = 15_000;
// LLM enrichment is cosmetic (the engine already writes solid copy), so cap it
// to once a minute per user instead of every cycle — a 4x cut in LLM calls.
const ENRICH_INTERVAL_MS = 60_000;

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
 * slow response can never overlap or stack up. Inputs flow through a ref so the
 * polling interval is created once per session, not rebuilt on every 2s sample.
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
  const lastEnrichAt = useRef(0);
  const hasResult = useRef(false);
  const latest = useRef({ sample, history, currentTrack, activity });
  latest.current = { sample, history, currentTrack, activity };

  const refresh = useCallback(async () => {
    const snap = latest.current;
    if (!snap.sample || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);

    const now = Date.now();
    const enrich = now - lastEnrichAt.current > ENRICH_INTERVAL_MS;
    if (enrich) lastEnrichAt.current = now;

    try {
      const result = await adaptiveClient.next({
        sessionId,
        activity: snap.activity,
        sample: snap.sample,
        history: snap.history.slice(-30),
        currentTrack: snap.currentTrack,
        enrich,
      });
      setRecommendation(result.recommendation);
      setCandidates(result.candidates);
      setLocal(result.local);
      hasResult.current = true;
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [sessionId]);

  // One interval per session. Reads inputs from the ref, so a new biometric
  // sample never tears the timer down.
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [enabled, refresh]);

  // Kick off the first recommendation as soon as a sample arrives.
  useEffect(() => {
    if (enabled && sample && !hasResult.current) void refresh();
  }, [enabled, sample, refresh]);

  return { recommendation, candidates, loading, local, refresh };
}
