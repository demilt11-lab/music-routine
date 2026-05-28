import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Centralised, typed query keys so invalidation stays consistent. */
export const qk = {
  profile: ["profile"] as const,
  activities: ["activities"] as const,
  sessions: (filter?: string) => ["sessions", filter ?? "all"] as const,
  session: (id: string) => ["session", id] as const,
  sessionTracks: (id: string) => ["session", id, "tracks"] as const,
  biometrics: (sessionId: string) => ["biometrics", sessionId] as const,
  insights: (range: string) => ["insights", range] as const,
  feedback: ["feedback"] as const,
  playlists: ["playlists"] as const,
};
