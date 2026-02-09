import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StartingSongRecommendation {
  optimalTempo: number;
  optimalEnergy: number;
  topSongs: Array<{
    id: string;
    title: string;
    artist: string;
    tempo: number | null;
    energy: number | null;
  }>;
  lastSessionSummary: {
    moodBefore: string | null;
    moodAfter: string | null;
    avgHeartRate: number | null;
    avgFocusScore: number | null;
    avgStressLevel: number | null;
    sessionDurationMin: number | null;
  } | null;
  hasHistory: boolean;
}

interface UseActivityStartingSongReturn {
  recommendation: StartingSongRecommendation | null;
  isLoading: boolean;
  fetchStartingSong: (activityTypeId: string) => Promise<void>;
}

// Default optimal ranges per activity name
const activityDefaults: Record<string, { tempo: number; energy: number }> = {
  workout: { tempo: 140, energy: 0.8 },
  study: { tempo: 115, energy: 0.45 },
  sleep: { tempo: 65, energy: 0.15 },
  relax: { tempo: 85, energy: 0.3 },
  commute: { tempo: 120, energy: 0.65 },
};

export function useActivityStartingSong(): UseActivityStartingSongReturn {
  const [recommendation, setRecommendation] = useState<StartingSongRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStartingSong = useCallback(async (activityTypeId: string) => {
    setIsLoading(true);
    setRecommendation(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Get the last 5 sessions for this activity
      const { data: sessions } = await supabase
        .from("listening_sessions")
        .select("id, started_at, ended_at, mood_before, mood_after, activity_type_id")
        .eq("user_id", user.id)
        .eq("activity_type_id", activityTypeId)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(5);

      if (!sessions || sessions.length === 0) {
        // No history - look up activity name for defaults
        const { data: activityType } = await supabase
          .from("activity_types")
          .select("name")
          .eq("id", activityTypeId)
          .single();

        const defaults = activityDefaults[activityType?.name || "study"] || activityDefaults.study;

        setRecommendation({
          optimalTempo: defaults.tempo,
          optimalEnergy: defaults.energy,
          topSongs: [],
          lastSessionSummary: null,
          hasHistory: false,
        });
        setIsLoading(false);
        return;
      }

      const sessionIds = sessions.map(s => s.id);

      // Fetch biometric readings and session songs in parallel
      const [biometricsResult, songsResult] = await Promise.all([
        supabase
          .from("biometric_readings")
          .select("heart_rate, focus_score, stress_level, relaxation_score")
          .in("session_id", sessionIds),
        supabase
          .from("session_songs")
          .select("song_id, play_duration_ms, skipped, songs(id, title, artist, tempo, energy)")
          .in("session_id", sessionIds)
          .eq("skipped", false)
          .order("play_duration_ms", { ascending: false }),
      ]);

      // Compute average biometrics from past sessions
      const readings = biometricsResult.data || [];
      const validHR = readings.filter(r => r.heart_rate != null);
      const validFocus = readings.filter(r => r.focus_score != null);
      const validStress = readings.filter(r => r.stress_level != null);

      const avgHeartRate = validHR.length > 0
        ? Math.round(validHR.reduce((s, r) => s + (r.heart_rate || 0), 0) / validHR.length)
        : null;
      const avgFocusScore = validFocus.length > 0
        ? Math.round(validFocus.reduce((s, r) => s + (r.focus_score || 0), 0) / validFocus.length)
        : null;
      const avgStressLevel = validStress.length > 0
        ? Math.round(validStress.reduce((s, r) => s + (r.stress_level || 0), 0) / validStress.length)
        : null;

      // Get top played songs (non-skipped, longest play time)
      const songEntries = (songsResult.data || [])
        .filter((ss: any) => ss.songs)
        .map((ss: any) => ss.songs);

      // Deduplicate by song id, keep first occurrence (highest play duration)
      const seen = new Set<string>();
      const topSongs = songEntries.filter((s: any) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      }).slice(0, 5);

      // Calculate optimal tempo/energy from top songs
      const songsWithTempo = topSongs.filter((s: any) => s.tempo != null);
      const songsWithEnergy = topSongs.filter((s: any) => s.energy != null);

      // Get activity name for defaults
      const { data: activityType } = await supabase
        .from("activity_types")
        .select("name")
        .eq("id", activityTypeId)
        .single();
      const defaults = activityDefaults[activityType?.name || "study"] || activityDefaults.study;

      const optimalTempo = songsWithTempo.length > 0
        ? Math.round(songsWithTempo.reduce((s: number, r: any) => s + r.tempo, 0) / songsWithTempo.length)
        : defaults.tempo;
      const optimalEnergy = songsWithEnergy.length > 0
        ? Math.round((songsWithEnergy.reduce((s: number, r: any) => s + r.energy, 0) / songsWithEnergy.length) * 100) / 100
        : defaults.energy;

      // Last session summary
      const lastSession = sessions[0];
      const durationMs = lastSession.ended_at && lastSession.started_at
        ? new Date(lastSession.ended_at).getTime() - new Date(lastSession.started_at).getTime()
        : null;

      setRecommendation({
        optimalTempo,
        optimalEnergy,
        topSongs: topSongs.map((s: any) => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          tempo: s.tempo,
          energy: s.energy,
        })),
        lastSessionSummary: {
          moodBefore: lastSession.mood_before,
          moodAfter: lastSession.mood_after,
          avgHeartRate,
          avgFocusScore,
          avgStressLevel,
          sessionDurationMin: durationMs ? Math.round(durationMs / 60000) : null,
        },
        hasHistory: true,
      });
    } catch (error) {
      console.error("Error fetching starting song data:", error);
      setRecommendation({
        optimalTempo: 120,
        optimalEnergy: 0.5,
        topSongs: [],
        lastSessionSummary: null,
        hasHistory: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { recommendation, isLoading, fetchStartingSong };
}
