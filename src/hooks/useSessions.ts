import { useState, useEffect, useCallback } from "react";
import { sessionsApi, ApiError } from "@/lib/api";
import type { Session, CreateSessionRequest, UpdateSessionRequest } from "@/types/models";

interface UseSessionsReturn {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  fetchSessions: () => Promise<void>;
  createSession: (data: CreateSessionRequest) => Promise<Session | null>;
  updateSession: (id: number, data: UpdateSessionRequest) => Promise<Session | null>;
  deleteSession: (id: number) => Promise<boolean>;
  addSongToSession: (sessionId: number, songId: number) => Promise<boolean>;
  removeSongFromSession: (sessionId: number, songId: number) => Promise<boolean>;
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await sessionsApi.getAll();
      setSessions(data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to fetch sessions";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = useCallback(
    async (data: CreateSessionRequest): Promise<Session | null> => {
      try {
        const newSession = await sessionsApi.create(data);
        setSessions((prev) => [newSession, ...prev]);
        return newSession;
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to create session";
        setError(message);
        return null;
      }
    },
    []
  );

  const updateSession = useCallback(
    async (id: number, data: UpdateSessionRequest): Promise<Session | null> => {
      try {
        const updated = await sessionsApi.update(id, data);
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? updated : s))
        );
        return updated;
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to update session";
        setError(message);
        return null;
      }
    },
    []
  );

  const deleteSession = useCallback(async (id: number): Promise<boolean> => {
    try {
      await sessionsApi.delete(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to delete session";
      setError(message);
      return false;
    }
  }, []);

  const addSongToSession = useCallback(
    async (sessionId: number, songId: number): Promise<boolean> => {
      try {
        const updated = await sessionsApi.addSong(sessionId, songId);
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? updated : s))
        );
        return true;
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to add song to session";
        setError(message);
        return false;
      }
    },
    []
  );

  const removeSongFromSession = useCallback(
    async (sessionId: number, songId: number): Promise<boolean> => {
      try {
        const updated = await sessionsApi.removeSong(sessionId, songId);
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? updated : s))
        );
        return true;
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to remove song from session";
        setError(message);
        return false;
      }
    },
    []
  );

  return {
    sessions,
    isLoading,
    error,
    fetchSessions,
    createSession,
    updateSession,
    deleteSession,
    addSongToSession,
    removeSongFromSession,
  };
}
