import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

  try {
    const { session_id }: { session_id: string } = await req.json();

    // Fetch session
    const { data: session, error: sessErr } = await supabase
      .from("listening_sessions")
      .select("*")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .single();
    if (sessErr || !session) throw new Error("Session not found");

    // Aggregate biometric data from this session
    const { data: biometrics } = await supabase
      .from("biometric_readings")
      .select("heart_rate, hrv_rmssd, focus_score, stress_level, recorded_at")
      .eq("session_id", session_id)
      .order("recorded_at", { ascending: true });

    const hrs        = (biometrics ?? []).map((b: { heart_rate: number }) => b.heart_rate).filter(Boolean);
    const hrvs       = (biometrics ?? []).map((b: { hrv_rmssd: number | null }) => b.hrv_rmssd).filter(Boolean) as number[];
    const focusScores= (biometrics ?? []).map((b: { focus_score: number | null }) => b.focus_score).filter(Boolean) as number[];

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    // Flow score computation (spec: flow_minutes / total_minutes * 100, weighted by depth)
    const totalMinutes = session.duration_minutes ?? 0;
    const flowMinutes  = session.time_in_flow_minutes ?? 0;
    const flowScore    = totalMinutes > 0 ? Math.min(100, Math.round((flowMinutes / totalMinutes) * 100)) : 0;

    // Fetch songs played in session with their training signals
    const { data: songsPlayed } = await supabase
      .from("session_songs")
      .select("song_id, skipped, completed, hr_delta, focus_delta, contributed_to_flow, songs(title, artist, bpm)")
      .eq("session_id", session_id)
      .order("played_at", { ascending: true });

    type SessionSong = {
      song_id: string; skipped: boolean; completed: boolean;
      hr_delta: number | null; focus_delta: number | null;
      contributed_to_flow: boolean;
      songs: { title: string; artist: string; bpm: number } | null;
    };

    const flowSongs    = (songsPlayed ?? []).filter((s: SessionSong) => s.contributed_to_flow);
    const disruptors   = (songsPlayed ?? []).filter((s: SessionSong) => s.skipped && !s.contributed_to_flow);

    // Build post-session report
    const report = {
      flow_score:             flowScore,
      time_in_flow_minutes:   Math.round(flowMinutes),
      total_session_minutes:  Math.round(totalMinutes),
      avg_heart_rate:         Math.round(avg(hrs) ?? 0),
      avg_hrv:                Math.round(avg(hrvs) ?? 0),
      avg_focus:              Math.round(avg(focusScores) ?? 0),
      peak_flow_window_start: session.flow_entry_time,
      peak_flow_duration_min: session.peak_flow_duration_minutes,
      songs_that_worked:      flowSongs.map((s: SessionSong) => ({
        title: s.songs?.title, artist: s.songs?.artist, bpm: s.songs?.bpm,
        hr_effect: s.hr_delta, focus_effect: s.focus_delta,
      })),
      songs_that_disrupted: disruptors.map((s: SessionSong) => ({
        title: s.songs?.title, artist: s.songs?.artist, reason: "skipped",
      })),
      generated_at: new Date().toISOString(),
    };

    // Persist report + update session averages
    await supabase.from("listening_sessions").update({
      flow_score,
      avg_heart_rate: avg(hrs),
      avg_hrv:        avg(hrvs),
      post_session_report: report,
    }).eq("id", session_id);

    // Update user biometric baseline with EMA (weight 0.1 per spec)
    const { data: baseline } = await supabase
      .from("user_biometric_baseline")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const ema = (current: number | null, observed: number | null, weight = 0.1) => {
      if (observed === null) return current;
      if (current === null)  return observed;
      return current * (1 - weight) + observed * weight;
    };

    const newRestingHr = avg(hrs.slice(0, Math.max(5, Math.floor(hrs.length * 0.1))));
    if (baseline) {
      await supabase.from("user_biometric_baseline").update({
        resting_hr:         ema(baseline.resting_hr,         newRestingHr),
        hrv_baseline_rmssd: ema(baseline.hrv_baseline_rmssd, avg(hrvs)),
        session_count:      (baseline.session_count ?? 0) + 1,
        established_at:     baseline.session_count >= 2 ? (baseline.established_at ?? new Date().toISOString()) : null,
        last_updated_at:    new Date().toISOString(),
      }).eq("user_id", user.id);
    } else {
      await supabase.from("user_biometric_baseline").insert({
        user_id:            user.id,
        resting_hr:         newRestingHr,
        hrv_baseline_rmssd: avg(hrvs),
        session_count:      1,
        last_updated_at:    new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[session-post-processor] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
