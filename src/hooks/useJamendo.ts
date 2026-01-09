import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

// Jamendo provides free Creative Commons music with a free API
// No authentication required for basic usage (80 requests/IP/minute)
const JAMENDO_CLIENT_ID = "b6747d04"; // Public demo client ID

export interface JamendoTrack {
  id: string;
  name: string;
  artist_name: string;
  album_name: string;
  duration: number;
  image: string;
  audio: string;
  audiodownload: string;
  license_ccurl: string;
}

export interface JamendoSearchParams {
  search?: string;
  tags?: string;
  speed?: "low" | "medium" | "high" | "veryhigh";
  mood?: "dark" | "light";
  acousticelectric?: "acoustic" | "electric";
  vocalinstrumental?: "vocal" | "instrumental";
  limit?: number;
}

interface UseJamendoReturn {
  tracks: JamendoTrack[];
  featuredTracks: JamendoTrack[];
  currentTrack: JamendoTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  error: string | null;
  search: (params: JamendoSearchParams) => Promise<void>;
  loadFeatured: () => Promise<void>;
  loadByMood: (mood: string) => Promise<void>;
  play: (track: JamendoTrack) => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  audioRef: React.RefObject<HTMLAudioElement>;
}

export function useJamendo(): UseJamendoReturn {
  const [tracks, setTracks] = useState<JamendoTrack[]>([]);
  const [featuredTracks, setFeaturedTracks] = useState<JamendoTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<JamendoTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const buildUrl = (endpoint: string, params: Record<string, string | number | undefined>) => {
    const url = new URL(`https://api.jamendo.com/v3.0/${endpoint}`);
    url.searchParams.set("client_id", JAMENDO_CLIENT_ID);
    url.searchParams.set("format", "json");
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
    
    return url.toString();
  };

  const search = useCallback(async (params: JamendoSearchParams) => {
    setIsLoading(true);
    setError(null);

    try {
      const url = buildUrl("tracks", {
        search: params.search,
        tags: params.tags,
        speed: params.speed,
        acousticelectric: params.acousticelectric,
        vocalinstrumental: params.vocalinstrumental,
        limit: params.limit || 20,
        include: "musicinfo",
        boost: "popularity_total",
      });

      const response = await fetch(url);
      const data = await response.json();

      if (data.results) {
        setTracks(data.results);
      } else {
        setTracks([]);
        if (data.error) {
          setError(data.error.message);
        }
      }
    } catch (err) {
      console.error("Jamendo search error:", err);
      setError("Failed to search tracks");
      toast.error("Failed to search Jamendo");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFeatured = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = buildUrl("tracks", {
        limit: 12,
        order: "popularity_total",
        include: "musicinfo",
        boost: "popularity_month",
      });

      const response = await fetch(url);
      const data = await response.json();

      if (data.results) {
        setFeaturedTracks(data.results);
      }
    } catch (err) {
      console.error("Jamendo featured error:", err);
      setError("Failed to load featured tracks");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadByMood = useCallback(async (mood: string) => {
    // Map activity types to Jamendo tags
    const moodTagMap: Record<string, string> = {
      sleep: "relaxing+ambient+calm",
      workout: "energetic+electronic+upbeat",
      study: "ambient+instrumental+focus",
      relax: "chillout+lounge+peaceful",
      commute: "pop+upbeat+happy",
      meditation: "ambient+spiritual+peaceful",
      party: "dance+electronic+energetic",
    };

    const tags = moodTagMap[mood.toLowerCase()] || mood;

    await search({
      tags,
      limit: 20,
      vocalinstrumental: mood === "study" || mood === "meditation" ? "instrumental" : undefined,
    });
  }, [search]);

  const play = useCallback((track: JamendoTrack) => {
    setCurrentTrack(track);
    if (audioRef.current) {
      audioRef.current.src = track.audio;
      audioRef.current.play();
    }
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else if (currentTrack) {
      audioRef.current?.play();
      setIsPlaying(true);
    }
  }, [isPlaying, pause, currentTrack]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, []);

  return {
    tracks,
    featuredTracks,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    isLoading,
    error,
    search,
    loadFeatured,
    loadByMood,
    play,
    pause,
    togglePlay,
    seek,
    audioRef,
  };
}
