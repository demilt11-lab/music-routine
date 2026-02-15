import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SpotifyQueueTrack {
  id: string;
  name: string;
  artist: string;
  uri: string;
  image: string;
  preview_url: string | null;
  duration_ms: number;
}

const STORAGE_KEY = "spotify_tokens";

function getStoredTokens() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function getValidToken(): Promise<string | null> {
  const tokens = getStoredTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expires_at - 60000) return tokens.access_token;

  try {
    const { data, error } = await supabase.functions.invoke("spotify-auth", {
      body: { action: "refresh_token", refresh_token: tokens.refresh_token },
    });
    if (error || data?.error) return null;
    const newTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || tokens.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTokens));
    return newTokens.access_token;
  } catch {
    return null;
  }
}

export function useSpotifyAutoQueue() {
  const [isSearching, setIsSearching] = useState(false);
  const lastSearchRef = useRef<string>("");

  const searchByRecommendation = useCallback(
    async (
      targetTempo: number,
      targetEnergy: number,
      activityType?: string
    ): Promise<SpotifyQueueTrack[]> => {
      const token = await getValidToken();
      if (!token) return [];

      const key = `${targetTempo}-${targetEnergy}`;
      if (lastSearchRef.current === key) return [];
      lastSearchRef.current = key;

      setIsSearching(true);
      try {
        // Build a mood/genre keyword from activity + energy
        const genre =
          activityType === "workout"
            ? "workout"
            : activityType === "sleep"
            ? "sleep ambient"
            : activityType === "study"
            ? "lo-fi focus"
            : activityType === "relax"
            ? "chill"
            : "focus";

        const energyWord =
          targetEnergy > 0.7 ? "energetic" : targetEnergy < 0.3 ? "calm" : "";

        const query = `${genre} ${energyWord}`.trim();

        const res = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return [];
        const data = await res.json();

        const tracks: SpotifyQueueTrack[] = (data.tracks?.items || []).map(
          (t: any) => ({
            id: t.id,
            name: t.name,
            artist: t.artists.map((a: any) => a.name).join(", "),
            uri: t.uri,
            image: t.album.images?.[0]?.url || "",
            preview_url: t.preview_url,
            duration_ms: t.duration_ms,
          })
        );

        return tracks;
      } catch {
        return [];
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  const isSpotifyConnected = useCallback((): boolean => {
    const tokens = getStoredTokens();
    return !!(tokens && Date.now() < tokens.expires_at);
  }, []);

  return { searchByRecommendation, isSearching, isSpotifyConnected };
}
