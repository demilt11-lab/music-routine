import { useCallback, useEffect, useRef, useState } from "react";
import { deriveFlowState, getActivityTarget, type Activity, type BiometricSample, type FlowState } from "@biomusic/core";
import { adaptiveClient } from "@/lib/adaptive-client";
import { SimulatedSource, WebBluetoothHeartRateSource, type BiometricSource } from "./source";
import { HealthKitSource } from "./healthkit-source";
import { MuseEegSource } from "./muse-source";

const MAX_HISTORY = 60;
const FLUSH_INTERVAL_MS = 10_000;

export type SourceId = "simulated" | "ble-heart-rate" | "healthkit" | "muse-eeg";

function createSource(id: SourceId, activity: Activity): BiometricSource {
  switch (id) {
    case "ble-heart-rate":
      return new WebBluetoothHeartRateSource();
    case "healthkit":
      return new HealthKitSource();
    case "muse-eeg":
      return new MuseEegSource();
    default:
      return new SimulatedSource(activity);
  }
}

interface Options {
  activity: Activity;
  sessionId?: string;
}

export interface BiometricsState {
  current: BiometricSample | null;
  history: BiometricSample[];
  flow: { state: FlowState; score: number };
  connected: boolean;
  sourceId: SourceId;
  error: string | null;
  start: (sourceId: SourceId) => Promise<void>;
  stop: () => void;
}

/**
 * Owns the live biometric stream for a session: it drives a pluggable source,
 * keeps a bounded rolling history, derives the flow state on every sample, and
 * batches samples to the adaptive service for durable storage + analytics.
 */
export function useBiometrics({ activity, sessionId }: Options): BiometricsState {
  const [current, setCurrent] = useState<BiometricSample | null>(null);
  const [history, setHistory] = useState<BiometricSample[]>([]);
  const [flow, setFlow] = useState<{ state: FlowState; score: number }>({ state: "none", score: 0.5 });
  const [connected, setConnected] = useState(false);
  const [sourceId, setSourceId] = useState<SourceId>("simulated");
  const [error, setError] = useState<string | null>(null);

  const sourceRef = useRef<BiometricSource | null>(null);
  const historyRef = useRef<BiometricSample[]>([]);
  const bufferRef = useRef<BiometricSample[]>([]);

  const flush = useCallback(async () => {
    if (!sessionId || bufferRef.current.length === 0) return;
    const batch = bufferRef.current;
    bufferRef.current = [];
    try {
      await adaptiveClient.ingestBiometrics({ sessionId, samples: batch });
    } catch {
      // Re-buffer on failure so no samples are lost between flushes.
      bufferRef.current = [...batch, ...bufferRef.current].slice(-200);
    }
  }, [sessionId]);

  const handleSample = useCallback(
    (sample: BiometricSample) => {
      const target = getActivityTarget(activity);
      const derived = deriveFlowState(sample, historyRef.current, target);
      historyRef.current = [...historyRef.current, sample].slice(-MAX_HISTORY);
      bufferRef.current.push(sample);
      setCurrent(sample);
      setHistory(historyRef.current);
      setFlow(derived);
    },
    [activity],
  );

  const stop = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
    setConnected(false);
    void flush();
  }, [flush]);

  const start = useCallback(
    async (id: SourceId) => {
      setError(null);
      sourceRef.current?.stop();
      const source = createSource(id, activity);
      try {
        await source.start(handleSample);
        sourceRef.current = source;
        setSourceId(id);
        setConnected(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to connect source");
        setConnected(false);
      }
    },
    [activity, handleSample],
  );

  // Periodic flush while a session is recording.
  useEffect(() => {
    if (!sessionId) return;
    const timer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [sessionId, flush]);

  // Tear down on unmount.
  useEffect(() => () => sourceRef.current?.stop(), []);

  return { current, history, flow, connected, sourceId, error, start, stop };
}
