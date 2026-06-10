/**
 * useUserMusicPreferences
 *
 * Loads per-user, per-activity learned music preferences from Supabase
 * and exposes them for use in usePredictiveQueue and useAdaptiveMusic.
 *
 * This closes the personalization feedback loop:
 *  track_feedback → upsert_music_preference → useUserMusicPreferences → queue building
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserMusicPreference {
  activityType:      string;
  preferredTempoAvg: number | null;
  preferredEnergyAvg: number | null;
  skipRate:          number;
  likeCount:         number;
  sessionCount:      number;
}

export function useUserMusicPreferences(activityType?: string) {
  const [preferences, setPreferences] = useState<UserMusicPreference[]>([]);
  const [isLoading, setIsLoading]     = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const query = supabase
        .from("user_music_preferences")
        .select("activity_type, preferred_tempo_avg, preferred_energy_avg, skip_rate, like_count, session_count")
        .eq("user_id", user.id);

      if (activityType) query.eq("activity_type", activityType);

      const { data, error } = await query;
      if (error || !data) return;

      setPreferences(
        data.map((row: any) => ({
          activityType:       row.activity_type,
          preferredTempoAvg:  row.preferred_tempo_avg   ? Number(row.preferred_tempo_avg)   : null,
          preferredEnergyAvg: row.preferred_energy_avg  ? Number(row.preferred_energy_avg)  : null,
          skipRate:           Number(row.skip_rate)      ?? 0,
          likeCount:          row.like_count             ?? 0,
          sessionCount:       row.session_count          ?? 0,
        }))
      );
    } finally {
      setIsLoading(false);
    }
  }, [activityType]);

  useEffect(() => { load(); }, [load]);

  /**
   * Returns the learned preference for a given activity,
   * or null if there is not enough data (cold start).
   * Confidence tier:
   *  - high:   >= 10 sessions with liked tracks
   *  - medium: 3–9  sessions
   *  - low:    1–2  sessions
   *  - cold:   0    sessions → return null (caller uses defaults)
   */
  const getPreferenceForActivity = useCallback((
    type: string
  ): { tempo: number; energy: number; confidence: "high" | "medium" | "low" } | null => {
    const pref = preferences.find(p => p.activityType === type);
    if (!pref || pref.likeCount < 1) return null;

    const confidence: "high" | "medium" | "low" =
      pref.likeCount >= 10 ? "high" :
      pref.likeCount >= 3  ? "medium" : "low";

    // Fallback to activity defaults if no learned values yet
    const activityDefaults: Record<string, { tempo: number; energy: number }> = {
      study:      { tempo: 100, energy: 0.50 },
      workout:    { tempo: 140, energy: 0.85 },
      sleep:      { tempo:  60, energy: 0.20 },
      relax:      { tempo:  75, energy: 0.35 },
      meditation: { tempo:  65, energy: 0.25 },
      commute:    { tempo: 110, energy: 0.60 },
    };
    const defaults = activityDefaults[type] ?? { tempo: 100, energy: 0.5 };

    return {
      tempo:      pref.preferredTempoAvg  ?? defaults.tempo,
      energy:     pref.preferredEnergyAvg ?? defaults.energy,
      confidence,
    };
  }, [preferences]);

  /**
   * Record feedback and update learned preferences via the DB function.
   */
  const recordFeedback = useCallback(async (
    type: string,
    tempo: number,
    energy: number,
    feedback: "up" | "down"
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.rpc("upsert_music_preference", {
      p_user_id:       user.id,
      p_activity_type: type,
      p_tempo:         tempo,
      p_energy:        energy,
      p_feedback:      feedback,
    });

    // Refresh local state
    await load();
  }, [load]);

  return {
    preferences,
    isLoading,
    getPreferenceForActivity,
    recordFeedback,
    reload: load,
  };
}
