import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TrackFeedback {
  trackTitle: string;
  trackArtist: string;
  feedback: "up" | "down";
  activityType?: string;
  targetTempo?: number;
  targetEnergy?: number;
}

interface FeedbackSummary {
  likedArtists: string[];
  dislikedArtists: string[];
  likedTempoRange: { min: number; max: number } | null;
  dislikedTempoRange: { min: number; max: number } | null;
  likedEnergyRange: { min: number; max: number } | null;
  preferenceDescription: string;
}

export function useTrackFeedback(activityType?: string) {
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "up" | "down">>({});
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const summaryRef = useRef<FeedbackSummary | null>(null);

  // Load existing feedback for this activity
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const query = supabase
        .from("track_feedback")
        .select("track_title, track_artist, feedback, target_tempo, target_energy")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (activityType) {
        query.eq("activity_type", activityType);
      }

      const { data } = await query;
      if (!data) return;

      // Build feedback map
      const map: Record<string, "up" | "down"> = {};
      data.forEach((row: any) => {
        const key = `${row.track_title}::${row.track_artist}`;
        map[key] = row.feedback;
      });
      setFeedbackMap(map);

      // Build summary for AI prompt injection
      const liked = data.filter((r: any) => r.feedback === "up");
      const disliked = data.filter((r: any) => r.feedback === "down");

      const likedArtists = [...new Set(liked.map((r: any) => r.track_artist))].slice(0, 10);
      const dislikedArtists = [...new Set(disliked.map((r: any) => r.track_artist))].slice(0, 10);

      const likedTempos = liked.map((r: any) => r.target_tempo).filter(Boolean);
      const dislikedTempos = disliked.map((r: any) => r.target_tempo).filter(Boolean);

      const likedEnergies = liked.map((r: any) => Number(r.target_energy)).filter(Boolean);

      const newSummary: FeedbackSummary = {
        likedArtists: likedArtists as string[],
        dislikedArtists: dislikedArtists as string[],
        likedTempoRange: likedTempos.length > 0
          ? { min: Math.min(...likedTempos), max: Math.max(...likedTempos) }
          : null,
        dislikedTempoRange: dislikedTempos.length > 0
          ? { min: Math.min(...dislikedTempos), max: Math.max(...dislikedTempos) }
          : null,
        likedEnergyRange: likedEnergies.length > 0
          ? { min: Math.min(...likedEnergies), max: Math.max(...likedEnergies) }
          : null,
        preferenceDescription: buildPreferenceDescription(likedArtists as string[], dislikedArtists as string[], liked.length, disliked.length),
      };

      setSummary(newSummary);
      summaryRef.current = newSummary;
    };

    load();
  }, [activityType]);

  const submitFeedback = useCallback(async (feedback: TrackFeedback) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sign in to save preferences");
      return;
    }

    const key = `${feedback.trackTitle}::${feedback.trackArtist}`;
    const existing = feedbackMap[key];

    // If same feedback already exists, toggle it off
    if (existing === feedback.feedback) {
      const { error } = await supabase
        .from("track_feedback")
        .delete()
        .eq("user_id", user.id)
        .eq("track_title", feedback.trackTitle)
        .eq("track_artist", feedback.trackArtist);

      if (!error) {
        setFeedbackMap(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
      return;
    }

    // Upsert: delete old then insert new
    await supabase
      .from("track_feedback")
      .delete()
      .eq("user_id", user.id)
      .eq("track_title", feedback.trackTitle)
      .eq("track_artist", feedback.trackArtist);

    const { error } = await supabase
      .from("track_feedback")
      .insert({
        user_id: user.id,
        track_title: feedback.trackTitle,
        track_artist: feedback.trackArtist,
        feedback: feedback.feedback,
        activity_type: feedback.activityType || null,
        target_tempo: feedback.targetTempo || null,
        target_energy: feedback.targetEnergy || null,
      });

    if (error) {
      toast.error("Failed to save feedback");
      return;
    }

    setFeedbackMap(prev => ({ ...prev, [key]: feedback.feedback }));

    const emoji = feedback.feedback === "up" ? "👍" : "👎";
    toast.success(`${emoji} Preference saved for "${feedback.trackTitle}"`);
  }, [feedbackMap]);

  const getFeedback = useCallback((title: string, artist: string): "up" | "down" | null => {
    return feedbackMap[`${title}::${artist}`] || null;
  }, [feedbackMap]);

  return {
    feedbackMap,
    summary,
    summaryRef,
    submitFeedback,
    getFeedback,
  };
}

function buildPreferenceDescription(
  liked: string[],
  disliked: string[],
  likedCount: number,
  dislikedCount: number
): string {
  const parts: string[] = [];

  if (likedCount > 0) {
    parts.push(`User has liked ${likedCount} tracks`);
    if (liked.length > 0) {
      parts.push(`Preferred artists: ${liked.slice(0, 5).join(", ")}`);
    }
  }

  if (dislikedCount > 0) {
    parts.push(`User has disliked ${dislikedCount} tracks`);
    if (disliked.length > 0) {
      parts.push(`Avoid artists: ${disliked.slice(0, 5).join(", ")}`);
    }
  }

  return parts.join(". ") || "No user preferences recorded yet.";
}
