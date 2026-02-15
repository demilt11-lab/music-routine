import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  image: string;
  uri: string;
  duration_ms: number;
  preview_url: string | null;
}

interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

const STORAGE_KEY = "spotify_tokens";

function getStoredTokens(): SpotifyTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeTokens(tokens: SpotifyTokens) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

function clearTokens() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useSpotify() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    const tokens = getStoredTokens();
    if (!tokens) return null;

    // If token is still valid (with 60s buffer)
    if (Date.now() < tokens.expires_at - 60000) {
      return tokens.access_token;
    }

    // Refresh the token
    try {
      const { data, error } = await supabase.functions.invoke('spotify-auth', {
        body: { action: 'refresh_token', refresh_token: tokens.refresh_token },
      });
      if (error || data?.error) throw new Error(data?.error || 'Refresh failed');

      const newTokens: SpotifyTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || tokens.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
      };
      storeTokens(newTokens);
      return newTokens.access_token;
    } catch {
      clearTokens();
      setIsConnected(false);
      return null;
    }
  }, []);

  // Check connection on mount
  useEffect(() => {
    const tokens = getStoredTokens();
    if (tokens && Date.now() < tokens.expires_at) {
      setIsConnected(true);
    }
  }, []);

  // Listen for auth callback via postMessage or URL params
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.data?.type !== 'spotify-auth') return;
      if (event.data.error) {
        toast.error("Spotify authorization was denied");
        return;
      }
      if (event.data.code) {
        await exchangeCode(event.data.code);
      }
    };
    window.addEventListener('message', handler);

    // Check URL params fallback (when popup was blocked)
    const urlParams = new URLSearchParams(window.location.search);
    const spotifyCode = urlParams.get('spotify_code');
    const spotifyError = urlParams.get('spotify_error');
    if (spotifyCode) {
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('spotify_code');
      window.history.replaceState({}, '', url.toString());
      exchangeCode(spotifyCode);
    } else if (spotifyError) {
      const url = new URL(window.location.href);
      url.searchParams.delete('spotify_error');
      window.history.replaceState({}, '', url.toString());
      toast.error("Spotify authorization was denied");
    }

    return () => window.removeEventListener('message', handler);
  }, []);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(audio.duration);
    const onEnded = () => { setIsPlaying(false); };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onDuration);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const redirectUri = `${window.location.origin.replace('://id-preview--', '://').replace('.lovable.app', '.supabase.co')}/functions/v1/spotify-callback`;

  const connect = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('spotify-auth', {
        body: {
          action: 'get_auth_url',
          redirect_uri: `https://iygbnnvsojlgztqvcghy.supabase.co/functions/v1/spotify-callback`,
        },
      });
      if (error || data?.error) throw new Error(data?.error || 'Failed to get auth URL');

      // Append state param with app origin for fallback redirect
      const authUrl = new URL(data.url);
      authUrl.searchParams.set('state', window.location.origin);
      const authUrlStr = authUrl.toString();

      // Open Spotify auth in popup
      const popup = window.open(authUrlStr, 'spotify-auth', 'width=500,height=700');
      if (!popup) {
        // Fallback: redirect in same window
        window.location.href = authUrlStr;
      }
    } catch (err) {
      toast.error("Failed to connect to Spotify");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const exchangeCode = useCallback(async (code: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('spotify-auth', {
        body: {
          action: 'exchange_token',
          code,
          redirect_uri: `https://iygbnnvsojlgztqvcghy.supabase.co/functions/v1/spotify-callback`,
        },
      });
      if (error || data?.error) throw new Error(data?.error || 'Token exchange failed');

      const tokens: SpotifyTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
      };
      storeTokens(tokens);
      setIsConnected(true);
      toast.success("Connected to Spotify!");
    } catch (err) {
      toast.error("Failed to connect to Spotify");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    clearTokens();
    setIsConnected(false);
    setTracks([]);
    setCurrentTrack(null);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    toast.success("Disconnected from Spotify");
  }, []);

  const search = useCallback(async (query: string) => {
    const token = await getValidToken();
    if (!token) { toast.error("Please connect to Spotify first"); return; }
    if (!query.trim()) return;

    setIsLoading(true);
    setSearchQuery(query);
    try {
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();

      const results: SpotifyTrack[] = data.tracks.items.map((t: any) => ({
        id: t.id,
        name: t.name,
        artist: t.artists.map((a: any) => a.name).join(', '),
        album: t.album.name,
        image: t.album.images?.[0]?.url || '',
        uri: t.uri,
        duration_ms: t.duration_ms,
        preview_url: t.preview_url,
      }));
      setTracks(results);
    } catch {
      toast.error("Spotify search failed");
    } finally {
      setIsLoading(false);
    }
  }, [getValidToken]);

  const play = useCallback((track: SpotifyTrack) => {
    if (track.preview_url) {
      if (audioRef.current) {
        audioRef.current.src = track.preview_url;
        audioRef.current.play();
      }
      setCurrentTrack(track);
      setIsPlaying(true);
    } else {
      // Open in Spotify app/web
      window.open(`https://open.spotify.com/track/${track.id}`, '_blank');
      toast.info("No preview available — opened in Spotify");
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else if (currentTrack?.preview_url && audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying, currentTrack, pause]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  return {
    isConnected,
    isLoading,
    tracks,
    currentTrack,
    isPlaying,
    searchQuery,
    currentTime,
    duration,
    audioRef,
    connect,
    disconnect,
    search,
    play,
    pause,
    togglePlay,
    seek,
  };
}
