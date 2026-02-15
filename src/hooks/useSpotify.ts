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

// Load Spotify Web Playback SDK script
function loadSpotifySDK(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).Spotify) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);
    (window as any).onSpotifyWebPlaybackSDKReady = () => resolve();
  });
}

export function useSpotify(onTrackPlay?: (track: SpotifyTrack) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sdkReady, setSdkReady] = useState(false);
  const [isPremium, setIsPremium] = useState(true);

  const audioRef = useRef<HTMLAudioElement>(null);
  const playerRef = useRef<any>(null);
  const deviceIdRef = useRef<string | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const onTrackPlayRef = useRef(onTrackPlay);
  onTrackPlayRef.current = onTrackPlay;

  const getValidToken = useCallback(async (): Promise<string | null> => {
    const tokens = getStoredTokens();
    if (!tokens) return null;

    if (Date.now() < tokens.expires_at - 60000) {
      return tokens.access_token;
    }

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

  // Initialize Web Playback SDK when connected
  const initializePlayer = useCallback(async () => {
    const token = await getValidToken();
    if (!token) return;

    try {
      await loadSpotifySDK();

      const SpotifySDK = (window as any).Spotify;
      if (!SpotifySDK) return;

      const player = new SpotifySDK.Player({
        name: "Routine Music",
        getOAuthToken: async (cb: (token: string) => void) => {
          const t = await getValidToken();
          if (t) cb(t);
        },
        volume: 0.5,
      });

      player.addListener("ready", ({ device_id }: { device_id: string }) => {
        deviceIdRef.current = device_id;
        setSdkReady(true);
        console.log("Spotify SDK ready, device:", device_id);
      });

      player.addListener("not_ready", () => {
        deviceIdRef.current = null;
        setSdkReady(false);
      });

      player.addListener("player_state_changed", (state: any) => {
        if (!state) return;
        setIsPlaying(!state.paused);
        setCurrentTime(state.position / 1000);
        setDuration(state.duration / 1000);
      });

      player.addListener("initialization_error", ({ message }: { message: string }) => {
        console.error("Spotify SDK init error:", message);
        setIsPremium(false);
      });

      player.addListener("authentication_error", ({ message }: { message: string }) => {
        console.error("Spotify SDK auth error:", message);
        setIsPremium(false);
      });

      player.addListener("account_error", ({ message }: { message: string }) => {
        console.error("Spotify SDK account error:", message);
        setIsPremium(false);
      });

      const connected = await player.connect();
      if (connected) {
        playerRef.current = player;
      } else {
        setIsPremium(false);
      }
    } catch (err) {
      console.error("Failed to init Spotify SDK:", err);
      setIsPremium(false);
    }
  }, [getValidToken]);

  // Check connection on mount
  useEffect(() => {
    const tokens = getStoredTokens();
    if (tokens && Date.now() < tokens.expires_at) {
      setIsConnected(true);
    }
  }, []);

  // Initialize SDK when connected
  useEffect(() => {
    if (isConnected) {
      initializePlayer();
    }
    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isConnected, initializePlayer]);

  // Progress tracking for SDK playback
  useEffect(() => {
    if (isPlaying && sdkReady && playerRef.current) {
      progressInterval.current = setInterval(async () => {
        const state = await playerRef.current?.getCurrentState();
        if (state) {
          setCurrentTime(state.position / 1000);
          setDuration(state.duration / 1000);
        }
      }, 1000);
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    }
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isPlaying, sdkReady]);

  // Handle Spotify OAuth redirect callback (for the tab that received the redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const spotifyCode = urlParams.get('spotify_code');
    const spotifyError = urlParams.get('spotify_error');
    if (spotifyCode) {
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
  }, []);

  // Listen for cross-tab localStorage changes (detects when OAuth completes in another tab)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const tokens: SpotifyTokens = JSON.parse(e.newValue);
          if (tokens.access_token && Date.now() < tokens.expires_at) {
            setIsConnected(true);
            toast.success("Connected to Spotify!");
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Audio element event listeners (fallback for non-Premium)
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

      const authUrl = new URL(data.url);
      authUrl.searchParams.set('state', window.location.origin);
      // Open in a new tab — iframe prevents direct navigation, and
      // popup postMessage breaks after Spotify's cross-origin redirects.
      // The callback will redirect back to the app with spotify_code param,
      // which writes to localStorage. We detect this via the storage event.
      window.open(authUrl.toString(), '_blank');
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
    if (playerRef.current) {
      playerRef.current.disconnect();
      playerRef.current = null;
    }
    clearTokens();
    setIsConnected(false);
    setSdkReady(false);
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

  const play = useCallback(async (track: SpotifyTrack) => {
    setCurrentTrack(track);

    // Try SDK playback first (Premium users)
    if (sdkReady && deviceIdRef.current) {
      const token = await getValidToken();
      if (token) {
        try {
          const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceIdRef.current}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ uris: [track.uri] }),
          });
          if (res.ok || res.status === 204) {
            setIsPlaying(true);
            setDuration(track.duration_ms / 1000);
            // Trigger adaptive curation callback
            onTrackPlayRef.current?.(track);
            return;
          }
        } catch (err) {
          console.error("SDK playback failed, falling back:", err);
        }
      }
    }

    // Fallback: use preview URL with audio element
    if (track.preview_url && audioRef.current) {
      audioRef.current.src = track.preview_url;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
      // Trigger adaptive curation callback
      onTrackPlayRef.current?.(track);
      return;
    }

    // Final fallback: search for similar tracks that have previews
    toast.info("Playing preview not available for this track. Try another one or connect Spotify Premium for full playback.");
  }, [sdkReady, getValidToken]);

  const pause = useCallback(async () => {
    if (sdkReady && playerRef.current) {
      await playerRef.current.pause();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, [sdkReady]);

  // Listen for adaptive engine Spotify play requests
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.name || !isConnected) return;

      // Search for the track by name + artist
      const token = await getValidToken();
      if (!token) return;

      try {
        const res = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(`${detail.name} ${detail.artist}`)}&type=track&limit=1`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          const t = data.tracks?.items?.[0];
          if (t) {
            const fullTrack: SpotifyTrack = {
              id: t.id,
              name: t.name,
              artist: t.artists.map((a: any) => a.name).join(", "),
              album: t.album.name,
              image: t.album.images?.[0]?.url || "",
              uri: t.uri,
              duration_ms: t.duration_ms,
              preview_url: t.preview_url,
            };
            play(fullTrack);
          }
        }
      } catch (err) {
        console.error("Adaptive Spotify play failed:", err);
      }
    };

    window.addEventListener("adaptive-spotify-play", handler);
    return () => window.removeEventListener("adaptive-spotify-play", handler);
  }, [isConnected, play, getValidToken]);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      await pause();
    } else {
      if (sdkReady && playerRef.current) {
        await playerRef.current.resume();
        setIsPlaying(true);
      } else if (currentTrack?.preview_url && audioRef.current) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  }, [isPlaying, currentTrack, pause, sdkReady]);

  const seek = useCallback(async (time: number) => {
    if (sdkReady && playerRef.current) {
      await playerRef.current.seek(time * 1000);
    }
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, [sdkReady]);

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
    sdkReady,
    isPremium,
    connect,
    disconnect,
    search,
    play,
    pause,
    togglePlay,
    seek,
  };
}
