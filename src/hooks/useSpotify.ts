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

interface SpotifyPlayerState {
  paused: boolean;
  position: number;
  duration: number;
}

interface SpotifySDKReadyWindow extends Window {
  Spotify?: {
    Player: new (config: {
      name: string;
      getOAuthToken: (cb: (token: string) => void) => void;
      volume: number;
    }) => SpotifyPlayerInstance;
  };
  onSpotifyWebPlaybackSDKReady?: () => void;
}

interface SpotifyPlayerInstance {
  addListener: (event: string, callback: (...args: any[]) => void) => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  getCurrentState: () => Promise<SpotifyPlayerState | null>;
}

const STORAGE_KEY = "spotify_tokens";
const SPOTIFY_SDK_SRC = "https://sdk.scdn.co/spotify-player.js";

let spotifySdkPromise: Promise<void> | null = null;

function canUseStorage() {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function getStoredTokens(): SpotifyTokens | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SpotifyTokens) : null;
  } catch {
    return null;
  }
}

function storeTokens(tokens: SpotifyTokens) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {}
}

function clearTokens() {
  if (!canUseStorage()) return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function mapSpotifyTrack(raw: any): SpotifyTrack {
  return {
    id: raw.id,
    name: raw.name,
    artist: raw.artists?.map((artist: any) => artist.name).join(", ") || "Unknown Artist",
    album: raw.album?.name || "Unknown Album",
    image: raw.album?.images?.[0]?.url || "",
    uri: raw.uri,
    duration_ms: raw.duration_ms || 0,
    preview_url: raw.preview_url || null,
  };
}

function loadSpotifySDK(): Promise<void> {
  if (spotifySdkPromise) return spotifySdkPromise;

  spotifySdkPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Spotify SDK requires a browser environment"));
      return;
    }

    const spotifyWindow = window as SpotifySDKReadyWindow;

    if (spotifyWindow.Spotify) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${SPOTIFY_SDK_SRC}"]`
    );

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = SPOTIFY_SDK_SRC;
      script.async = true;
      script.onerror = () => reject(new Error("Failed to load Spotify SDK"));
      document.body.appendChild(script);
    }

    spotifyWindow.onSpotifyWebPlaybackSDKReady = () => resolve();
  });

  return spotifySdkPromise;
}

export function useSpotify(onTrackPlay?: (track: SpotifyTrack) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sdkReady, setSdkReady] = useState(false);
  const [isPremium, setIsPremium] = useState(true);

  const audioRef = useRef<HTMLAudioElement>(null);
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTrackPlayRef = useRef(onTrackPlay);
  const mountedRef = useRef(true);
  const initializingPlayerRef = useRef(false);
  const lastProgressSecondRef = useRef(-1);

  onTrackPlayRef.current = onTrackPlay;

  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const disconnectPlayer = useCallback(() => {
    clearProgressInterval();

    if (playerRef.current) {
      playerRef.current.disconnect();
      playerRef.current = null;
    }

    deviceIdRef.current = null;
    setSdkReady(false);
  }, [clearProgressInterval]);

  const resetPlaybackState = useCallback(() => {
    setTracks([]);
    setCurrentTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
  }, []);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    const tokens = getStoredTokens();
    if (!tokens) return null;

    if (Date.now() < tokens.expires_at - 60_000) {
      return tokens.access_token;
    }

    try {
      const { data, error } = await supabase.functions.invoke("spotify-auth", {
        body: {
          action: "refresh_token",
          refresh_token: tokens.refresh_token,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || "Refresh failed");
      }

      const newTokens: SpotifyTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || tokens.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
      };

      storeTokens(newTokens);
      return newTokens.access_token;
    } catch {
      clearTokens();
      disconnectPlayer();
      resetPlaybackState();

      if (mountedRef.current) {
        setIsConnected(false);
      }

      return null;
    }
  }, [disconnectPlayer, resetPlaybackState]);

  const exchangeCode = useCallback(async (code: string) => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("spotify-auth", {
        body: {
          action: "exchange_token",
          code,
          redirect_uri: `https://iygbnnvsojlgztqvcghy.supabase.co/functions/v1/spotify-callback`,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || "Token exchange failed");
      }

      const tokens: SpotifyTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
      };

      storeTokens(tokens);

      if (mountedRef.current) {
        setIsConnected(true);
        toast.success("Connected to Spotify!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect to Spotify");
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const initializePlayer = useCallback(async () => {
    if (initializingPlayerRef.current || playerRef.current) return;

    initializingPlayerRef.current = true;

    try {
      const token = await getValidToken();
      if (!token) return;

      await loadSpotifySDK();

      const spotifyWindow = window as SpotifySDKReadyWindow;
      if (!spotifyWindow.Spotify) return;

      const player = new spotifyWindow.Spotify.Player({
        name: "BioMusic",
        getOAuthToken: async (cb) => {
          const nextToken = await getValidToken();
          if (nextToken) cb(nextToken);
        },
        volume: 0.5,
      });

      player.addListener("ready", ({ device_id }: { device_id: string }) => {
        deviceIdRef.current = device_id;
        if (mountedRef.current) {
          setSdkReady(true);
        }
      });

      player.addListener("not_ready", () => {
        deviceIdRef.current = null;
        if (mountedRef.current) {
          setSdkReady(false);
        }
      });

      player.addListener("player_state_changed", (state: SpotifyPlayerState | null) => {
        if (!state || !mountedRef.current) return;

        const nextSecond = Math.floor(state.position / 1000);
        if (lastProgressSecondRef.current !== nextSecond) {
          lastProgressSecondRef.current = nextSecond;
          setCurrentTime(nextSecond);
        }

        setDuration(Math.floor(state.duration / 1000));
        setIsPlaying(!state.paused);
      });

      player.addListener("initialization_error", ({ message }: { message: string }) => {
        console.error("Spotify SDK init error:", message);
        if (mountedRef.current) {
          setIsPremium(false);
        }
      });

      player.addListener("authentication_error", ({ message }: { message: string }) => {
        console.error("Spotify SDK auth error:", message);
        if (mountedRef.current) {
          setIsPremium(false);
        }
      });

      player.addListener("account_error", ({ message }: { message: string }) => {
        console.error("Spotify SDK account error:", message);
        if (mountedRef.current) {
          setIsPremium(false);
        }
      });

      const connected = await player.connect();

      if (connected) {
        playerRef.current = player;
      } else if (mountedRef.current) {
        setIsPremium(false);
      }
    } catch (err) {
      console.error("Failed to init Spotify SDK:", err);
      if (mountedRef.current) {
        setIsPremium(false);
      }
    } finally {
      initializingPlayerRef.current = false;
    }
  }, [getValidToken]);

  const connect = useCallback(async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("spotify-auth", {
        body: {
          action: "get_auth_url",
          redirect_uri: `https://iygbnnvsojlgztqvcghy.supabase.co/functions/v1/spotify-callback`,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || "Failed to get auth URL");
      }

      const authUrl = new URL(data.url);
      authUrl.searchParams.set("state", window.location.origin);
      window.open(authUrl.toString(), "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect to Spotify");
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    disconnectPlayer();
    clearTokens();
    resetPlaybackState();
    setIsConnected(false);
    toast.success("Disconnected from Spotify");
  }, [disconnectPlayer, resetPlaybackState]);

  const search = useCallback(
    async (query: string) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return;

      const token = await getValidToken();
      if (!token) {
        toast.error("Please connect to Spotify first");
        return;
      }

      setIsLoading(true);

      try {
        const res = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(trimmedQuery)}&type=track&limit=20`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          throw new Error("Search failed");
        }

        const data = await res.json();
        const results = (data.tracks?.items || []).map(mapSpotifyTrack);
        if (mountedRef.current) {
          setTracks(results);
        }
      } catch (err) {
        console.error(err);
        toast.error("Spotify search failed");
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [getValidToken]
  );

  const play = useCallback(
    async (track: SpotifyTrack) => {
      setCurrentTrack(track);
      setDuration(Math.floor(track.duration_ms / 1000));
      setCurrentTime(0);

      if (sdkReady && deviceIdRef.current) {
        const token = await getValidToken();

        if (token) {
          try {
            const res = await fetch(
              `https://api.spotify.com/v1/me/player/play?device_id=${deviceIdRef.current}`,
              {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ uris: [track.uri] }),
              }
            );

            if (res.ok || res.status === 204) {
              setIsPlaying(true);
              onTrackPlayRef.current?.(track);
              return;
            }
          } catch (err) {
            console.error("SDK playback failed, falling back:", err);
          }
        }
      }

      if (track.preview_url && audioRef.current) {
        audioRef.current.src = track.preview_url;
        try {
          await audioRef.current.play();
          setIsPlaying(true);
          onTrackPlayRef.current?.(track);
          return;
        } catch (err) {
          console.error("Preview playback failed:", err);
        }
      }

      toast.info(
        "Preview not available for this track. Try another one or connect Spotify Premium for full playback."
      );
    },
    [getValidToken, sdkReady]
  );

  const pause = useCallback(async () => {
    if (sdkReady && playerRef.current) {
      await playerRef.current.pause();
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    setIsPlaying(false);
  }, [sdkReady]);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      await pause();
      return;
    }

    if (sdkReady && playerRef.current) {
      await playerRef.current.resume();
      setIsPlaying(true);
      return;
    }

    if (currentTrack?.preview_url && audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Preview resume failed:", err);
      }
    }
  }, [currentTrack, isPlaying, pause, sdkReady]);

  const seek = useCallback(
    async (time: number) => {
      if (sdkReady && playerRef.current) {
        await playerRef.current.seek(time * 1000);
      }

      if (audioRef.current) {
        audioRef.current.currentTime = time;
      }

      setCurrentTime(Math.floor(time));
    },
    [sdkReady]
  );

  useEffect(() => {
    mountedRef.current = true;

    const tokens = getStoredTokens();
    if (tokens && Date.now() < tokens.expires_at) {
      setIsConnected(true);
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    void initializePlayer();

    return () => {
      disconnectPlayer();
    };
  }, [disconnectPlayer, initializePlayer, isConnected]);

  useEffect(() => {
    if (!isPlaying || !sdkReady || !playerRef.current || document.hidden) {
      clearProgressInterval();
      return;
    }

    progressIntervalRef.current = setInterval(async () => {
      const state = await playerRef.current?.getCurrentState();
      if (!state || !mountedRef.current) return;

      const nextSecond = Math.floor(state.position / 1000);
      if (lastProgressSecondRef.current !== nextSecond) {
        lastProgressSecondRef.current = nextSecond;
        setCurrentTime(nextSecond);
      }

      setDuration(Math.floor(state.duration / 1000));
    }, 1000);

    return () => {
      clearProgressInterval();
    };
  }, [clearProgressInterval, isPlaying, sdkReady]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearProgressInterval();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [clearProgressInterval]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const spotifyCode = url.searchParams.get("spotify_code");
    const spotifyError = url.searchParams.get("spotify_error");

    if (spotifyCode) {
      url.searchParams.delete("spotify_code");
      window.history.replaceState({}, "", url.toString());
      void exchangeCode(spotifyCode);
      return;
    }

    if (spotifyError) {
      url.searchParams.delete("spotify_error");
      window.history.replaceState({}, "", url.toString());
      toast.error("Spotify authorization was denied");
    }
  }, [exchangeCode]);

  useEffect(() => {
    if (!canUseStorage()) return;

    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;

      try {
        const tokens = JSON.parse(e.newValue) as SpotifyTokens;
        if (tokens.access_token && Date.now() < tokens.expires_at) {
          setIsConnected(true);
          toast.success("Connected to Spotify!");
        }
      } catch {}
    };

    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      const nextSecond = Math.floor(audio.currentTime);
      if (lastProgressSecondRef.current !== nextSecond) {
        lastProgressSecondRef.current = nextSecond;
        setCurrentTime(nextSecond);
      }
    };

    const onLoadedMetadata = () => {
      setDuration(Math.floor(audio.duration || 0));
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    const handler = async (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail?.name || !isConnected) return;

      const token = await getValidToken();
      if (!token) return;

      try {
        const res = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(
            `${detail.name} ${detail.artist || ""}`
          )}&type=track&limit=1`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) return;

        const data = await res.json();
        const rawTrack = data.tracks?.items?.[0];
        if (!rawTrack) return;

        await play(mapSpotifyTrack(rawTrack));
      } catch (err) {
        console.error("Adaptive Spotify play failed:", err);
      }
    };

    window.addEventListener("adaptive-spotify-play", handler);
    return () => window.removeEventListener("adaptive-spotify-play", handler);
  }, [getValidToken, isConnected, play]);

  return {
    isConnected,
    isLoading,
    tracks,
    currentTrack,
    isPlaying,
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
