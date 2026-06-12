import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  classifyBiometricState,
  resolveActivityProfile,
  type ClassificationResult,
  type StateClass,
} from "@/lib/classifier";
import {
  computeBiometricWindow,
  computeTrackResponse,
  isOptimalFamily,
  StateTracker,
  TriggerGate,
  type ReadingLike,
  type Urgency,
} from "@/lib/biometric-window";

// Deterministic reactive loop (spec Module 5): classification runs locally
// every 5 seconds against the same shared classifier the backend uses; the
// playlist-engine edge function is only called when a duration-gated trigger
// fires, and every engine-selected play is closed out with a training signal
// via dsp-connector complete_song_play.

const TICK_MS = 5_000;
const STATE_LOG_CAP = 1_500; // ~2h of 5s ticks

export type FlowEventName = "FLOW_ENTERED" | "FLOW_SUSTAINED_30MIN" | "FLOW_DISRUPTED";

export interface EngineSelectedSong {
  id: string;
  title: string;
  artist: string;
  tempo: number | null;
  energy: number | null;
  spotify_track_id: string | null;
  spotify_id: string | null;
  apple_music_id: string | null;
}

interface FlowSnapshot {
  in_flow: boolean;
  flow_entry_time: string | null;
  flow_duration_seconds: number;
  maintenance_mode: boolean;
}

interface UseReactiveEngineOptions {
  sessionId: string | null;
  activityName: string | null;
  enabled: boolean;
  onTrackSelected?: (
    song: EngineSelectedSong,
    reason: string,
    urgency: Urgency,
    transitionSequence?: EngineSelectedSong[],
  ) => void;
  onFlowEvent?: (event: FlowEventName, durationS: number) => void;
}

interface UseReactiveEngineReturn {
  classification: ClassificationResult | null;
  flow: { inFlow: boolean; maintenanceMode: boolean; durationS: number };
  /** Feed every biometric reading here (the hook keeps its own buffer). */
  pushReading: (reading: ReadingLike) => void;
  /** Call when the user manually skips — a skip <15s in is a negative signal. */
  notifyManualSkip: () => void;
  /** Closes out the in-flight track and persists state/trigger logs. */
  finishSession: () => Promise<void>;
}

export function useReactiveEngine({
  sessionId,
  activityName,
  enabled,
  onTrackSelected,
  onFlowEvent,
}: UseReactiveEngineOptions): UseReactiveEngineReturn {
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [flowView, setFlowView] = useState({ inFlow: false, maintenanceMode: false, durationS: 0 });

  const readingsRef = useRef<ReadingLike[]>([]);
  const trackerRef = useRef(new StateTracker());
  const gateRef = useRef(new TriggerGate());
  const flowRef = useRef<FlowSnapshot>({
    in_flow: false,
    flow_entry_time: null,
    flow_duration_seconds: 0,
    maintenance_mode: false,
  });
  const milestone30Ref = useRef(false);
  const stateLogRef = useRef<Array<{ t: string; state: StateClass; confidence: number }>>([]);
  const triggerLogRef = useRef<Array<Record<string, unknown>>>([]);
  const playedIdsRef = useRef<string[]>([]);
  const currentTrackRef = useRef<{ songId: string; startedAt: number; tempo: number | null } | null>(null);
  const baselineRef = useRef({ hrmaxEstimate: 185, restingHr: 60 });
  const busyRef = useRef(false);
  const detectorBusyRef = useRef(false);

  const callbacksRef = useRef({ onTrackSelected, onFlowEvent });
  callbacksRef.current = { onTrackSelected, onFlowEvent };
  const sessionRef = useRef<{ sessionId: string | null; activityName: string | null }>({ sessionId, activityName });
  sessionRef.current = { sessionId, activityName };

  const pushReading = useCallback((reading: ReadingLike) => {
    const buf = readingsRef.current;
    buf.push(reading);
    // Keep ~5 minutes; computeTrackResponse needs at most start-30s history
    if (buf.length > 300) readingsRef.current = buf.slice(-300);
  }, []);

  const recordTrackOutcome = useCallback(async (skipped: boolean) => {
    const track = currentTrackRef.current;
    const { sessionId: sid } = sessionRef.current;
    if (!track || !sid) return;
    currentTrackRef.current = null;

    const { hr_delta, focus_delta } = computeTrackResponse(readingsRef.current, track.startedAt);
    try {
      await supabase.functions.invoke("dsp-connector", {
        body: {
          action: "complete_song_play",
          session_id: sid,
          song_id: track.songId,
          hr_delta,
          focus_delta,
          contributed_to_flow: flowRef.current.in_flow,
          skipped,
        },
      });
    } catch (err) {
      console.error("[reactive-engine] failed to record track outcome:", err);
    }
  }, []);

  const notifyManualSkip = useCallback(() => {
    const track = currentTrackRef.current;
    if (!track) return;
    const earlySkip = Date.now() - track.startedAt < 15_000;
    void recordTrackOutcome(earlySkip);
  }, [recordTrackOutcome]);

  const finishSession = useCallback(async () => {
    const { sessionId: sid } = sessionRef.current;
    await recordTrackOutcome(false);
    if (!sid) return;
    try {
      await supabase
        .from("listening_sessions")
        .update({
          state_log: stateLogRef.current as unknown as Json,
          trigger_log: triggerLogRef.current as unknown as Json,
        })
        .eq("id", sid);
    } catch (err) {
      console.error("[reactive-engine] failed to persist session logs:", err);
    }
  }, [recordTrackOutcome]);

  useEffect(() => {
    if (!enabled || !sessionId || !activityName) return;

    // Fresh session — reset all trackers
    trackerRef.current = new StateTracker();
    gateRef.current = new TriggerGate();
    flowRef.current = { in_flow: false, flow_entry_time: null, flow_duration_seconds: 0, maintenance_mode: false };
    milestone30Ref.current = false;
    stateLogRef.current = [];
    triggerLogRef.current = [];
    playedIdsRef.current = [];
    readingsRef.current = [];
    currentTrackRef.current = null;

    // Personalized HRmax (220 - age) and resting HR from accumulated baseline
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: profile }, { data: baseline }] = await Promise.all([
        supabase.from("profiles").select("age").eq("id", user.id).single(),
        supabase.from("user_biometric_baseline").select("resting_hr, hrmax_estimate").eq("user_id", user.id).maybeSingle(),
      ]);
      const age = profile?.age ?? 35;
      baselineRef.current = {
        hrmaxEstimate: baseline?.hrmax_estimate ?? 220 - age,
        restingHr: baseline?.resting_hr ?? 60,
      };
    })();

    const tick = async () => {
      const now = Date.now();
      const { sessionId: sid, activityName: activity } = sessionRef.current;
      if (!sid || !activity) return;

      const tracker = trackerRef.current;
      const window = computeBiometricWindow(readingsRef.current, {
        hrmaxEstimate: baselineRef.current.hrmaxEstimate,
        restingHr: baselineRef.current.restingHr,
        timeInCurrentStateS: tracker.timeInStateS(now),
        previousState: tracker.previousState,
        now,
      });
      if (!window) return;

      const profile = resolveActivityProfile(activity);
      const result = classifyBiometricState(window, profile);
      tracker.update(result.state, now);
      setClassification(result);

      if (stateLogRef.current.length < STATE_LOG_CAP) {
        stateLogRef.current.push({
          t: new Date(now).toISOString(),
          state: result.state,
          confidence: result.confidence,
        });
      }

      // ── Flow transitions (server persists flow events) ──
      const famS = tracker.optimalFamilySeconds(now);
      const flow = flowRef.current;
      const shouldCallDetector =
        (!flow.in_flow && famS >= 600) ||
        (flow.in_flow && !isOptimalFamily(result.state)) ||
        (flow.in_flow && famS >= 1800 && !milestone30Ref.current);

      if (shouldCallDetector && !detectorBusyRef.current) {
        detectorBusyRef.current = true;
        try {
          const { data } = await supabase.functions.invoke("flow-state-detector", {
            body: {
              session_id: sid,
              context: {
                current_state: result.state,
                time_in_optimal_s: famS,
                hr_std: window.hr_std,
                focus_score: window.focus_score_mean,
                previous_flow: flow,
              },
            },
          });
          if (data?.flow_state) {
            flowRef.current = data.flow_state as FlowSnapshot;
            setFlowView({
              inFlow: flowRef.current.in_flow,
              maintenanceMode: flowRef.current.maintenance_mode,
              durationS: flowRef.current.flow_duration_seconds,
            });
          }
          if (data?.event) {
            if (data.event === "FLOW_SUSTAINED_30MIN") milestone30Ref.current = true;
            callbacksRef.current.onFlowEvent?.(data.event as FlowEventName, famS);
          }
        } catch (err) {
          console.error("[reactive-engine] flow detector call failed:", err);
        } finally {
          detectorBusyRef.current = false;
        }
      } else if (flow.in_flow) {
        setFlowView((prev) => ({ ...prev, durationS: famS }));
      }

      // ── Duration-gated trigger → server-side song selection ──
      const decision = gateRef.current.evaluate(result.state, flowRef.current.maintenance_mode, now);
      if (!decision.fire || busyRef.current) return;

      busyRef.current = true;
      try {
        const { data, error } = await supabase.functions.invoke("playlist-engine", {
          body: {
            session_id: sid,
            activity_type: activity,
            biometric_window: window,
            current_bpm: currentTrackRef.current?.tempo ?? 110,
            played_this_session: playedIdsRef.current,
            user_override_speechiness: false,
            urgency: decision.urgency,
          },
        });
        if (error) throw error;

        const song = (data?.selected_song ?? null) as EngineSelectedSong | null;
        triggerLogRef.current.push({
          t: new Date(now).toISOString(),
          state: result.state,
          urgency: decision.urgency,
          song_id: song?.id ?? null,
          reason: data?.reason ?? null,
        });

        if (song) {
          // Close out the previous engine-selected play before switching
          await recordTrackOutcome(false);
          currentTrackRef.current = { songId: song.id, startedAt: Date.now(), tempo: song.tempo };
          playedIdsRef.current.push(song.id);
          const sequence = (data?.transition_sequence ?? []) as EngineSelectedSong[];
          for (const s of sequence) playedIdsRef.current.push(s.id);
          callbacksRef.current.onTrackSelected?.(song, data?.reason ?? result.state, decision.urgency, sequence);
        }
      } catch (err) {
        console.error("[reactive-engine] playlist-engine call failed:", err);
      } finally {
        busyRef.current = false;
      }
    };

    const interval = setInterval(() => void tick(), TICK_MS);
    return () => clearInterval(interval);
  }, [enabled, sessionId, activityName, recordTrackOutcome]);

  return {
    classification,
    flow: flowView,
    pushReading,
    notifyManualSkip,
    finishSession,
  };
}
