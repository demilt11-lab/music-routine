import { useState, useEffect, useCallback } from "react";
import { spotifyApi, ApiError } from "@/lib/api";

interface UseSpotifyReturn {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  expiresAt: number | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<boolean>;
  checkStatus: () => Promise<void>;
}

export function useSpotify(): UseSpotifyReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const status = await spotifyApi.getConnectionStatus();
      setIsConnected(status.connected);
      setExpiresAt(status.expires_at ?? null);
    } catch (err) {
      // If we can't check status, assume not connected
      setIsConnected(false);
      setExpiresAt(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const connect = useCallback(async () => {
    setError(null);

    try {
      const { auth_url } = await spotifyApi.getAuthUrl();
      // Redirect to Spotify OAuth page
      window.location.href = auth_url;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to connect to Spotify";
      setError(message);
    }
  }, []);

  const disconnect = useCallback(async (): Promise<boolean> => {
    setError(null);

    try {
      await spotifyApi.disconnect();
      setIsConnected(false);
      setExpiresAt(null);
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to disconnect from Spotify";
      setError(message);
      return false;
    }
  }, []);

  return {
    isConnected,
    isLoading,
    error,
    expiresAt,
    connect,
    disconnect,
    checkStatus,
  };
}
