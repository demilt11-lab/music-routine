import { supabase } from "@/lib/supabase";
import type { Activity, ActivityRow, SessionRow, SessionTrackRow } from "@/lib/database.types";

export async function fetchActivities(): Promise<ActivityRow[]> {
  const { data, error } = await supabase.from("activities").select("*").order("sort_order");
  if (error) throw error;
  return data;
}

export async function fetchSessions(userId: string, limit = 50): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function fetchSession(id: string): Promise<SessionRow | null> {
  const { data, error } = await supabase.from("sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchSessionTracks(sessionId: string): Promise<SessionTrackRow[]> {
  const { data, error } = await supabase
    .from("session_tracks")
    .select("*")
    .eq("session_id", sessionId)
    .order("position");
  if (error) throw error;
  return data;
}

export async function createSession(input: {
  userId: string;
  activity: Activity;
  name?: string;
}): Promise<SessionRow> {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ user_id: input.userId, activity: input.activity, name: input.name ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function completeSession(id: string, patch: { avgFlowScore?: number; moodAfter?: string }): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({
      status: "completed",
      ended_at: new Date().toISOString(),
      avg_flow_score: patch.avgFlowScore ?? null,
      mood_after: patch.moodAfter ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}
