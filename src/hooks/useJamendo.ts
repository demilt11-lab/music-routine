import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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
  searchByTempoEnergy: (
    targetTempo: number,
    targetEnergy: number,
    activityType?: string
  ) => Promise<JamendoTrack[]>;
  play: (track: JamendoTrack) => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  seek: (time: number) => void;
  setOnTrackEnd: (callback: (() => void) | null) => void;
  audioRef: React.RefObject<HTMLAudioElement>;
}

const moodTagMap: Record<string, string> = {
  sleep: "relaxing+ambient+calm",
  workout: "energetic+electronic+upbeat",
  study: "ambient+instrumental+focus",
  relax: "chillout+lounge+peaceful",
  commute: "pop+upbeat+happy",
  meditation: "ambient+spiritual+peaceful",
  party: "dance+electronic+energetic",
};

const activityTags: Record<string, string> = {
  sleep: "ambient+relaxing",
  workout: "energetic+electronic",
  study: "focus+instrumental",
  relax: "chillout+peaceful",
  commute: "pop+upbeat",
};

function buildJamendoUrl(
  endpoint: string,
  params: Record<string, string | number | undefined>
) {
  const url = new URL(`${SUPABASE_URL}/functions/v1/jamendo-proxy`);
  url.searchParams.set("endpoint", endpoint);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function fetchJamendo<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Jamendo request failed with status ${response.status}`);
  }

  return response.json();
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
  const onTrackEndRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const activeRequestIdRef = useRef(0);
  const lastWholeSecondRef = useRef(-1);

  const search = useCallback(async (params: JamendoSearchParams) => {
    const requestId = ++activeRequestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const url = buildJamendoUrl("tracks", {
        search: params.search?.trim(),
        tags: params.tags,
        speed: params.speed,
        acousticelectric: params.acousticelectric,
        vocalinstrumental: params.vocalinstrumental,
        limit: params.limit || 20,
        include: "musicinfo",
        boost: "popularity_total",
      });

      const data = await fetchJamendo<{ results?: JamendoTrack[]; error?: { message?: string } }>(url);

      if (!mountedRef.current || requestId !== activeRequestIdRef.current) return;

      if (data.results) {
        setTracks(data.results);
      } else {
        setTracks([]);
        setError(data.error?.message || "No tracks found");
      }
    } catch (err) {
      console.error("Jamendo search error:", err);

      if (!mountedRef.current || requestId !== activeRequestIdRef.current) return;

      setTracks([]);
      setError("Failed to search tracks");
      toast.error("Failed to search Jamendo");
    } finally {
      if (mountedRef.current && requestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const loadFeatured = useCallback(async () => {
    const requestId = ++activeRequestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const url = buildJamendoUrl("tracks", {
        limit: 12,
        order: "popularity_total",
        include: "musicinfo",
        boost: "popularity_month",
      });

      const data = await fetchJamendo<{ results?: JamendoTrack[] }>(url);

      if (!mountedRef.current || requestId !== activeRequestIdRef.current) return;

      setFeaturedTracks(data.results || []);
    } catch (err) {
      console.error("Jamendo featured error:", err);

      if (!mountedRef.current || requestId !== activeRequestIdRef.current) return;

      setFeaturedTracks([]);
      setError("Failed to load featured tracks");
    } finally {
      if (mountedRef.current && requestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const loadByMood = useCallback(
    async (mood: string) => {
      const normalizedMood = mood.toLowerCase();
      const tags = moodTagMap[normalizedMood] || mood;

      await search({
        tags,
        limit: 20,
        vocalinstrumental:
          normalizedMood === "study" || normalizedMood === "meditation"
            ? "instrumental"
            : undefined,
      });
    },
    [search]
  );

  const searchByTempoEnergy = useCallback(
    async (
      targetTempo: number,
      targetEnergy: number,
      activityType?: string
    ): Promise<JamendoTrack[]> => {
      try {
        let speed: "low" | "medium" | "high" | "veryhigh" | undefined;

        if (targetTempo < 80) speed = "low";
        else if (targetTempo < 110) speed = "medium";
        else if (targetTempo < 140) speed = "high";
        else speed = "veryhigh";

        const acousticelectric = targetEnergy < 0.4 ? "acoustic" : "electric";
        const tags = activityType ? activityTags[activityType.toLowerCase()] : undefined;

        const url = buildJamendoUrl("tracks", {
          tags,
          speed,
          acousticelectric,
          vocalinstrumental: targetEnergy < 0.5 ? "instrumental" : undefined,
          limit: 10,
          include: "musicinfo",
          boost: "popularity_total",
        });

        const data = await fetchJamendo<{ results?: JamendoTrack[] }>(url);
        return data.results || [];
      } catch (err) {
        console.error("Jamendo tempo/energy search error:", err);
        return [];
      }
    },
    []
  );

  const play = useCallback(async (track: JamendoTrack) => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTrack(track);

    if (audio.src !== track.audio) {
      audio.src = track.audio;
      audio.preload = "none";
      setCurrentTime(0);
      lastWholeSecondRef.current = -1;
    }

    try {
      await audio.play();
      if (mountedRef.current) {
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Jamendo play error:", err);
      if (mountedRef.current) {
        setIsPlaying(false);
      }
      toast.error("Unable to play track");
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      pause();
      return;
    }

    try {
      await audio.play();
      if (mountedRef.current) {
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Jamendo resume error:", err);
      toast.error("Unable to resume playback");
    }
  }, [currentTrack, isPlaying, pause]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = time;
    const rounded = Math.floor(time);

    if (lastWholeSecondRef.current !== rounded) {
      lastWholeSecondRef.current = rounded;
      setCurrentTime(rounded);
    }
  }, []);

  const setOnTrackEnd = useCallback((callback: (() => void) | null) => {
    onTrackEndRef.current = callback;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const rounded = Math.floor(audio.currentTime);
      if (lastWholeSecondRef.current !== rounded) {
        lastWholeSecondRef.current = rounded;
        setCurrentTime(rounded);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(Math.floor(audio.duration || 0));
    };

    const handleDurationChange = () => {
      setDuration(Math.floor(audio.duration || 0));
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      lastWholeSecondRef.current = -1;

      if (onTrackEndRef.current) {
        onTrackEndRef.current();
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
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
    searchByTempoEnergy,
    play,
    pause,
    togglePlay,
    seek,
    setOnTrackEnd,
    audioRef,
  };
}
