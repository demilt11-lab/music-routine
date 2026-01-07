import { useState, useEffect, useCallback } from "react";
import { songsApi, ApiError } from "@/lib/api";
import type { Song } from "@/types/models";

interface UseSongsReturn {
  songs: Song[];
  isLoading: boolean;
  error: string | null;
  fetchSongs: () => Promise<void>;
  createSong: (data: Omit<Song, "id">) => Promise<Song | null>;
  deleteSong: (id: number) => Promise<boolean>;
}

export function useSongs(): UseSongsReturn {
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSongs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await songsApi.getAll();
      setSongs(data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to fetch songs";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  const createSong = useCallback(
    async (data: Omit<Song, "id">): Promise<Song | null> => {
      try {
        const newSong = await songsApi.create(data);
        setSongs((prev) => [newSong, ...prev]);
        return newSong;
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to create song";
        setError(message);
        return null;
      }
    },
    []
  );

  const deleteSong = useCallback(async (id: number): Promise<boolean> => {
    try {
      await songsApi.delete(id);
      setSongs((prev) => prev.filter((s) => s.id !== id));
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to delete song";
      setError(message);
      return false;
    }
  }, []);

  return {
    songs,
    isLoading,
    error,
    fetchSongs,
    createSong,
    deleteSong,
  };
}
