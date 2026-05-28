import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query";
import { useAuth } from "@/app/auth";
import type { Activity } from "@/lib/database.types";
import {
  completeSession,
  createSession,
  fetchActivities,
  fetchSession,
  fetchSessions,
  fetchSessionTracks,
} from "./api";

export function useActivities() {
  return useQuery({ queryKey: qk.activities, queryFn: fetchActivities, staleTime: 60 * 60 * 1000 });
}

export function useSessions(limit?: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.sessions(),
    enabled: !!user,
    queryFn: () => fetchSessions(user!.id, limit),
  });
}

export function useSession(id: string) {
  return useQuery({ queryKey: qk.session(id), enabled: !!id, queryFn: () => fetchSession(id) });
}

export function useSessionTracks(id: string) {
  return useQuery({ queryKey: qk.sessionTracks(id), enabled: !!id, queryFn: () => fetchSessionTracks(id) });
}

export function useCreateSession() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { activity: Activity; name?: string }) => createSession({ userId: user!.id, ...input }),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.sessions() }),
  });
}

export function useCompleteSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; avgFlowScore?: number; moodAfter?: string }) =>
      completeSession(input.id, input),
    onSuccess: (_data, vars) => {
      client.invalidateQueries({ queryKey: qk.sessions() });
      client.invalidateQueries({ queryKey: qk.session(vars.id) });
    },
  });
}
