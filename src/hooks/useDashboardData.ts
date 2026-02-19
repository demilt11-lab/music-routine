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

export function useRecentPlaylists(userId: string | undefined) {
  return useQuery({
    queryKey: ["recent-playlists", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_playlists")
        .select("*, activity_types(name)")
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
