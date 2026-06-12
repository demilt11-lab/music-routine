import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  classifyBiometricState,
  resolveActivityProfile,
  validateBPMTransition,
  passesSpeechinessFilter,
  type BiometricWindow,
  type StateClass,
} from "../_shared/classifier.ts";
import {
  blendProfiles,
  pickTransitionSequence,
  type ResponseProfile,
} from "../_shared/selection.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  Deno.env.get("APP_ORIGIN") ?? "*",
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
    if (["yoga", "meditation", "recovery", "sleep"].includes(activityType))
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

    // The service-role client bypasses RLS — verify the session belongs to
    // the caller before reading state for it or writing play logs to it.
    if (session_id) {
      const { data: session } = await supabase
        .from("listening_sessions")
        .select("id, user_id")
        .eq("id", session_id)
        .single();
      if (!session || session.user_id !== user.id) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          status: 404, headers: CORS_HEADERS,
        });
      }
    }

    // 1. Classify state (shared profiles — single source of truth)
    const profile        = resolveActivityProfile(activity_type);
    const classification = classifyBiometricState(biometric_window, profile);
    const direction      = stateToDirection(classification.state);
    const ranges         = getTargetFeatureRanges(direction, profile.activity_type);

    // 2. Query candidate songs (schema columns: tempo = BPM, energy = 0-1)
    let query = supabase
      .from("songs")
      .select("id, title, artist, tempo, energy, valence, speechiness, spotify_track_id, spotify_id, apple_music_id, avg_hr_delta_60s, avg_stress_delta_60s, avg_focus_delta_60s")
      .gte("tempo", ranges.bpm_min)
      .lte("tempo", ranges.bpm_max)
      .gte("energy", ranges.energy_min)
      .lte("energy", ranges.energy_max)
      .limit(80);

    // C-17: Speechiness filter — CRITICAL for study/meditation/sleep
    if (["study", "meditation", "sleep"].includes(profile.activity_type) && !user_override_speechiness) {
      query = query.lte("speechiness", 0.3);
    }

    const { data: candidates, error: songErr } = await query;
    if (songErr) throw new Error(`Song query failed: ${songErr.message}`);

    // 3. Filter: no repeats this session (M-8: no hallucinated fallbacks)
    const filtered = (candidates ?? []).filter(
      (s: { id: string }) => !played_this_session.includes(s.id),
    );

    // 3b. Personal/population blend inputs (spec Module 7): the user's
    // session count sets the personal-model weight; population aggregates
    // are keyed by spotify_track_id.
    const { data: baseline } = await supabase
      .from("user_biometric_baseline")
      .select("session_count")
      .eq("user_id", user.id)
      .maybeSingle();
    const sessionCount = baseline?.session_count ?? 0;

    const trackIds = filtered
      .map((s: { spotify_track_id: string | null }) => s.spotify_track_id)
      .filter((t: string | null): t is string => t !== null);
    const populationByTrack = new Map<string, ResponseProfile>();
    if (trackIds.length > 0) {
      const { data: popRows } = await supabase
        .from("population_song_response")
        .select("spotify_track_id, avg_hr_delta_60s, avg_focus_delta_60s, avg_stress_delta_60s")
        .in("spotify_track_id", trackIds);
      for (const row of popRows ?? []) {
        populationByTrack.set(row.spotify_track_id, {
          avg_hr_delta_60s: row.avg_hr_delta_60s,
          avg_focus_delta_60s: row.avg_focus_delta_60s,
          avg_stress_delta_60s: row.avg_stress_delta_60s,
        });
      }
    }

    if (filtered.length === 0) {
      return new Response(JSON.stringify({
        state: classification,
        selected_song: null,
        reason: "No eligible songs found matching current state constraints",
      }), { headers: CORS_HEADERS });
    }

    // 4. Score candidates (simple population model — personalized model blended later)
    type SongCandidate = {
      id: string; title: string; artist: string; tempo: number | null;
      energy: number | null; valence: number | null; speechiness: number | null;
      spotify_track_id: string | null; spotify_id: string | null; apple_music_id: string | null;
      avg_hr_delta_60s: number | null; avg_stress_delta_60s: number | null;
      avg_focus_delta_60s: number | null;
    };
    const scored = filtered.map((song: SongCandidate) => {
      let score = 0;

      // Physio response score — personal profile blended with the
      // anonymized population profile (weight grows with session count,
      // capped 0.85 personal / floor 0.15 population)
      const blended = blendProfiles(
        {
          avg_hr_delta_60s: song.avg_hr_delta_60s,
          avg_focus_delta_60s: song.avg_focus_delta_60s,
          avg_stress_delta_60s: song.avg_stress_delta_60s,
        },
        song.spotify_track_id ? populationByTrack.get(song.spotify_track_id) ?? null : null,
        sessionCount,
      );
      if (direction === "UP") {
        // Want HR increase, focus increase
        if (blended.avg_hr_delta_60s  !== null) score += blended.avg_hr_delta_60s  * 2;
        if (blended.avg_focus_delta_60s !== null) score += blended.avg_focus_delta_60s;
      } else if (direction === "DOWN") {
        // Want HR decrease, stress decrease
        if (blended.avg_hr_delta_60s    !== null) score -= blended.avg_hr_delta_60s * 2;
        if (blended.avg_stress_delta_60s !== null) score -= blended.avg_stress_delta_60s;
      }

      // C-16: BPM transition penalty — soft score reduction for large jumps
      const songBpm  = song.tempo ?? 120;
      const bpmDelta = Math.abs(songBpm - current_bpm);
      const bpmValid = validateBPMTransition(current_bpm, songBpm, urgency);
      if (!bpmValid.allowed) return null; // hard filter
      score -= bpmDelta * 0.5; // penalize large jumps even within limit

      // C-17: speechiness compliance check (secondary guard)
      if (!passesSpeechinessFilter(song.speechiness, profile.activity_type, user_override_speechiness)) {
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

    // 4b. Progressive transition sequence (spec Module 4): for gradual
    // transitions, 2 follow-up songs stepping ≤15 BPM per hop toward the
    // target. Urgent transitions get a single immediate track instead.
    let transitionSequence: typeof scored = [];
    if (direction !== "MAINTAIN" && urgency !== "HIGH" && selected!.tempo !== null) {
      const followUps = pickTransitionSequence(
        scored.slice(1).map((s) => ({ id: s!.id, tempo: s!.tempo, score: s!.score })),
        selected!.tempo,
        ranges.bpm_min,
        ranges.bpm_max,
        { maxStepBpm: 15, length: 2 },
      );
      const byId = new Map(scored.map((s) => [s!.id, s]));
      transitionSequence = followUps.map((f) => byId.get(f.id)!).filter(Boolean);
    }

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
      // Lookahead for the client to queue; outcomes are recorded when these
      // actually become the playing track.
      transition_sequence: transitionSequence,
      reason:        `State: ${classification.state} → ${direction}. Confidence: ${(classification.confidence * 100).toFixed(0)}%`,
    }), { headers: CORS_HEADERS });

  } catch (err) {
    console.error("[playlist-engine] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: CORS_HEADERS,
    });
  }
});
