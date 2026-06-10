import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useActivityTypes() {
  return useQuery({
    queryKey: ["activity-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("activity_types").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserSessions(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-sessions", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listening_sessions")
        .select("id, name, started_at, ended_at, mood_before, mood_after, activity_type_id")
        .eq("user_id", userId!)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

// Fix: added .eq("user_id", userId!) to prevent leaking other users' playlists
export function useRecentPlaylists(userId: string | undefined) {
  return useQuery({
    queryKey: ["recent-playlists", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_playlists")
        .select("*, activity_types(name)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useSessionBiometrics(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["session-biometrics", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biometric_readings")
        .select("focus_score, heart_rate")
        .eq("session_id", sessionId!);
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
    staleTime: 5 * 60 * 1000,
  });
}

// Fix: added .limit(500) to prevent unbounded query that could OOM the browser
export function useAllBiometrics(userId: string | undefined) {
  return useQuery({
    queryKey: ["all-biometrics", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biometric_readings")
        .select("*")
        .eq("user_id", userId!)
        .order("recorded_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useBiometricsByRange(userId: string | undefined, timeRange: "24h" | "7d" | "30d") {
  return useQuery({
    queryKey: ["biometrics-range", userId, timeRange],
    queryFn: async () => {
      const startDate = new Date();
      if (timeRange === "24h") startDate.setHours(startDate.getHours() - 24);
      else if (timeRange === "7d") startDate.setDate(startDate.getDate() - 7);
      else startDate.setDate(startDate.getDate() - 30);

      const { data, error } = await supabase
        .from("biometric_readings")
        .select("*")
        .eq("user_id", userId!)
        .gte("recorded_at", startDate.toISOString())
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useSessionsByRange(userId: string | undefined, timeRange: "24h" | "7d" | "30d") {
  return useQuery({
    queryKey: ["sessions-range", userId, timeRange],
    queryFn: async () => {
      const startDate = new Date();
      if (timeRange === "24h") startDate.setHours(startDate.getHours() - 24);
      else if (timeRange === "7d") startDate.setDate(startDate.getDate() - 7);
      else startDate.setDate(startDate.getDate() - 30);

      const { data, error } = await supabase
        .from("listening_sessions")
        .select(`
          id, name, started_at,
          activity_types(name),
          session_songs(songs(tempo, energy, valence))
        `)
        .eq("user_id", userId!)
        .gte("started_at", startDate.toISOString());
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useSessionsDetailed(userId: string | undefined) {
  return useQuery({
    queryKey: ["sessions-detailed", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listening_sessions")
        .select(`
          *,
          activity_types(id, name),
          session_songs(
            id, song_id, skipped, play_duration_ms,
            songs(id, title, artist, tempo, energy, valence, danceability)
          )
        `)
        .eq("user_id", userId!)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}
