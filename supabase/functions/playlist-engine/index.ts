import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  classifyBiometricState,
  validateBPMTransition,
  passesSpeechinessFilter,
  type BiometricWindow,
  type StateClass,
} from "../state-classifier/index.ts";

import { ORIGIN } from "../_shared/cors.ts";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

// ── Target audio feature ranges per state transition ──────────
function getTargetFeatureRanges(
  direction: "UP" | "DOWN" | "MAINTAIN",
  activityType: string,
): { bpm_min: number; bpm_max: number; energy_min: number; energy_max: number } {
  if (direction === "UP") {
    if (activityType === "cardio") return { bpm_min: 140, bpm_max: 180, energy_min: 0.75, energy_max: 1.0 };
    if (activityType === "strength_training") return { bpm_min: 130, bpm_max: 175, energy_min: 0.8, energy_max: 1.0 };
    return { bpm_min: 120, bpm_max: 160, energy_min: 0.7, energy_max: 1.0 };
  }
  if (direction === "DOWN") {
    if (["yoga", "meditation", "recovery"].includes(activityType))
      return { bpm_min: 50, bpm_max: 80, energy_min: 0.1, energy_max: 0.4 };
    if (activityType === "study") return { bpm_min: 60, bpm_max: 80, energy_min: 0.2, energy_max: 0.5 };
    return { bpm_min: 70, bpm_max: 100, energy_min: 0.3, energy_max: 0.6 };
  }
  // MAINTAIN
  return { bpm_min: 80, bpm_max: 140, energy_min: 0.4, energy_max: 0.8 };
}

function stateToDirection(state: StateClass): "UP" | "DOWN" | "MAINTAIN" {
  if (["UNDERPERFORMING", "DROWSY", "FATIGUED"].includes(state)) return "UP";
  if (["OVEREXERTING", "ANXIOUS", "RECOVERING"].includes(state))  return "DOWN";
  if (["OPTIMAL", "FLOW"].includes(state))                         return "MAINTAIN";
  if (state === "DISTRACTED")                                       return "UP"; // gentle stimulation
  return "MAINTAIN";
}

// ── Main handler ──────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_HEADERS });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_HEADERS });

  try {
    const body = await req.json();
    const {
      session_id,
      activity_type,
      biometric_window,
      current_bpm,
      played_this_session = [],
      user_override_speechiness = false,
      urgency = "MEDIUM",
    }: {
      session_id: string;
      activity_type: string;
      biometric_window: BiometricWindow;
      current_bpm: number;
      played_this_session: string[];
      user_override_speechiness: boolean;
      urgency: "LOW" | "MEDIUM" | "HIGH";
    } = body;

    // Validate required fields
    if (!session_id || typeof session_id !== "string") {
      return new Response(JSON.stringify({ error: "session_id is required" }), { status: 400, headers: CORS_HEADERS });
    }

    // 1. Classify state
    const ACTIVITY_PROFILES: Record<string, Parameters<typeof classifyBiometricState>[1]> = {
      strength_training: { activity_type: "strength_training", hr_min_pct: 0.70, hr_max_pct: 0.90, hr_optimal_min_pct: 0.75, hr_optimal_max_pct: 0.82, hrv_target: "moderate", eeg_target: "beta", focus_threshold: null, stress_max: 60 },
      cardio:    { activity_type: "cardio",    hr_min_pct: 0.65, hr_max_pct: 0.88, hr_optimal_min_pct: 0.65, hr_optimal_max_pct: 0.80, hrv_target: "moderate", eeg_target: null, focus_threshold: null, stress_max: 70 },
      yoga:      { activity_type: "yoga",      hr_min_pct: 0.50, hr_max_pct: 0.65, hr_optimal_min_pct: 0.50, hr_optimal_max_pct: 0.65, hrv_target: "high", eeg_target: "alpha", focus_threshold: null, stress_max: 40 },
      study:     { activity_type: "study",     hr_min_pct: 0, hr_max_pct: 1, hr_optimal_min_pct: 0, hr_optimal_max_pct: 1, hrv_target: "high", eeg_target: "alpha", focus_threshold: 60, stress_max: 35 },
      meditation:{ activity_type: "meditation",hr_min_pct: 0, hr_max_pct: 1, hr_optimal_min_pct: 0, hr_optimal_max_pct: 1, hrv_target: "high", eeg_target: "alpha_theta", focus_threshold: null, stress_max: 20 },
      creative_work: { activity_type: "creative_work", hr_min_pct: 0, hr_max_pct: 1, hr_optimal_min_pct: 0, hr_optimal_max_pct: 1, hrv_target: "high", eeg_target: "alpha_theta", focus_threshold: 50, stress_max: 40 },
      recovery:  { activity_type: "recovery",  hr_min_pct: 0, hr_max_pct: 0.65, hr_optimal_min_pct: 0, hr_optimal_max_pct: 0.60, hrv_target: "high", eeg_target: null, focus_threshold: null, stress_max: 30 },
    };
    const VALID_ACTIVITIES = Object.keys(ACTIVITY_PROFILES);
    if (activity_type && !VALID_ACTIVITIES.includes(activity_type)) {
      return new Response(
        JSON.stringify({ error: `Invalid activity_type. Must be one of: ${VALID_ACTIVITIES.join(", ")}` }),
        { status: 400, headers: CORS_HEADERS },
      );
    }
    const profile = ACTIVITY_PROFILES[activity_type] ?? ACTIVITY_PROFILES["study"];
    const classification = classifyBiometricState(biometric_window, profile);
    const direction      = stateToDirection(classification.state);
    const ranges         = getTargetFeatureRanges(direction, activity_type);

    // 2. Query candidate songs
    let query = supabase
      .from("songs")
      .select("id, title, artist, bpm, energy_level, valence, speechiness, spotify_track_id, apple_music_id, avg_hr_delta_60s, avg_stress_delta_60s, avg_focus_delta_60s")
      .gte("bpm", ranges.bpm_min)
      .lte("bpm", ranges.bpm_max)
      .gte("energy_level", ranges.energy_min)
      .lte("energy_level", ranges.energy_max)
      .limit(80);

    // C-17: Speechiness filter — CRITICAL for study/meditation
    if (["study", "meditation", "sleep"].includes(activity_type) && !user_override_speechiness) {
      query = query.lte("speechiness", 0.3);
    }

    const { data: candidates, error: songErr } = await query;
    if (songErr) throw new Error(`Song query failed: ${songErr.message}`);

    // 3. Filter: no repeats this session (M-8: no hallucinated fallbacks)
    const filtered = (candidates ?? []).filter(
      (s: { id: string }) => !played_this_session.includes(s.id),
    );

    if (filtered.length === 0) {
      return new Response(JSON.stringify({
        state: classification,
        selected_song: null,
        reason: "No eligible songs found matching current state constraints",
      }), { headers: CORS_HEADERS });
    }

    // 4. Score candidates (simple population model — personalized model blended later)
    type SongCandidate = {
      id: string; title: string; artist: string; bpm: number;
      energy_level: number; valence: number; speechiness: number | null;
      spotify_track_id: string | null; apple_music_id: string | null;
      avg_hr_delta_60s: number | null; avg_stress_delta_60s: number | null;
      avg_focus_delta_60s: number | null;
    };
    const scored = filtered.map((song: SongCandidate) => {
      let score = 0;

      // Physio response score
      if (direction === "UP") {
        // Want HR increase, focus increase
        if (song.avg_hr_delta_60s  !== null) score += song.avg_hr_delta_60s  * 2;
        if (song.avg_focus_delta_60s !== null) score += song.avg_focus_delta_60s;
      } else if (direction === "DOWN") {
        // Want HR decrease, stress decrease
        if (song.avg_hr_delta_60s    !== null) score -= song.avg_hr_delta_60s * 2;
        if (song.avg_stress_delta_60s !== null) score -= song.avg_stress_delta_60s;
      }

      // C-16: BPM transition penalty — soft score reduction for large jumps
      const bpmDelta = Math.abs((song.bpm ?? 120) - current_bpm);
      const bpmValid = validateBPMTransition(current_bpm, song.bpm ?? 120, urgency);
      if (!bpmValid.allowed) return null; // hard filter
      score -= bpmDelta * 0.5; // penalize large jumps even within limit

      // C-17: speechiness compliance check (secondary guard)
      if (!passesSpeechinessFilter(song.speechiness, activity_type, user_override_speechiness)) {
        return null;
      }

      return { ...song, score };
    }).filter(Boolean).sort((a: { score: number } | null, b: { score: number } | null) => (b?.score ?? 0) - (a?.score ?? 0));

    if (scored.length === 0) {
      return new Response(JSON.stringify({
        state: classification,
        selected_song: null,
        reason: "All candidates failed BPM or speechiness constraints",
      }), { headers: CORS_HEADERS });
    }

    const selected = scored[0];

    // 5. Log selection as training signal
    if (session_id) {
      await supabase.from("session_songs").insert({
        session_id,
        song_id: selected!.id,
        played_at: new Date().toISOString(),
        biometric_state_at_start: JSON.stringify(biometric_window),
        selection_reason: `state=${classification.state} direction=${direction}`,
        queued_at_state: classification.state,
      });
    }

    return new Response(JSON.stringify({
      state:         classification,
      direction,
      selected_song: selected,
      reason:        `State: ${classification.state} → ${direction}. Confidence: ${(classification.confidence * 100).toFixed(0)}%`,
    }), { headers: CORS_HEADERS });

  } catch (err) {
    console.error("[playlist-engine] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: CORS_HEADERS,
    });
  }
});
