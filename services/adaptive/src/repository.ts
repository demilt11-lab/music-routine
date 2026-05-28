import { derivePreferences, type FeedbackRecord, type UserPreferences, type Track } from "@biomusic/core";
import type { BiometricIngestRequest } from "@biomusic/core/contracts";
import { getServiceClient } from "./supabase.js";

/**
 * All persistence is funnelled through here and is ALWAYS scoped to the
 * authenticated `userId`. The service-role key bypasses RLS, so this scoping
 * is the security boundary — never expose a query that omits it.
 */

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const { data, error } = await getServiceClient()
    .from("track_feedback")
    .select("track_artist, feedback, target_tempo, target_energy")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error || !data) return { likedArtists: [], dislikedArtists: [] };

  const records: FeedbackRecord[] = data.map((r) => ({
    trackArtist: r.track_artist as string,
    feedback: r.feedback as "up" | "down",
    targetTempo: r.target_tempo as number | null,
    targetEnergy: r.target_energy as number | null,
  }));
  return derivePreferences(records);
}

export async function ingestBiometrics(userId: string, req: BiometricIngestRequest): Promise<number> {
  const rows = req.samples.map((s) => ({
    user_id: userId,
    session_id: req.sessionId,
    recorded_at: s.recordedAt,
    heart_rate: s.heartRate ?? null,
    hrv: s.hrv ?? null,
    stress_level: s.stressLevel ?? null,
    focus_score: s.focusScore ?? null,
    relaxation_score: s.relaxationScore ?? null,
    meditation_score: s.meditationScore ?? null,
    eeg_alpha: s.eeg?.alpha ?? null,
    eeg_beta: s.eeg?.beta ?? null,
    eeg_theta: s.eeg?.theta ?? null,
    eeg_gamma: s.eeg?.gamma ?? null,
    eeg_delta: s.eeg?.delta ?? null,
    device_type: s.deviceType ?? null,
  }));

  // Ownership check: the session must belong to the caller.
  const { data: session } = await getServiceClient()
    .from("sessions")
    .select("id")
    .eq("id", req.sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!session) throw new Error("session not found");

  const { error } = await getServiceClient().from("biometric_readings").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function saveGeneratedPlaylist(
  userId: string,
  playlist: { activity: string; name: string; description: string; reasoning: string; tracks: Track[] },
): Promise<string | null> {
  const { data, error } = await getServiceClient()
    .from("generated_playlists")
    .insert({
      user_id: userId,
      activity: playlist.activity,
      name: playlist.name,
      description: playlist.description,
      reasoning: playlist.reasoning,
      tracks: playlist.tracks,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id as string;
}
