import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/query";
import { useAuth } from "@/app/auth";
import type { Activity, FeedbackValue } from "@/lib/database.types";

export interface FeedbackInput {
  trackTitle: string;
  trackArtist: string;
  feedback: FeedbackValue;
  activity?: Activity;
  targetTempo?: number;
  targetEnergy?: number;
}

/** Thumbs up/down on the currently playing track — feeds the personalisation loop. */
export function useSubmitFeedback() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: FeedbackInput) => {
      const { error } = await supabase.from("track_feedback").insert({
        user_id: user!.id,
        track_title: input.trackTitle,
        track_artist: input.trackArtist,
        feedback: input.feedback,
        activity: input.activity ?? null,
        target_tempo: input.targetTempo ?? null,
        target_energy: input.targetEnergy ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      client.invalidateQueries({ queryKey: qk.feedback });
      toast.success(vars.feedback === "up" ? "Liked — we'll play more like this" : "Got it — we'll avoid this");
    },
    onError: () => toast.error("Couldn't save feedback"),
  });
}
