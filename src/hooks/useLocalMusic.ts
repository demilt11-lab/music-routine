import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LocalTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  file: File;
  objectUrl: string;
  coverArt?: string;
}

interface UseLocalMusicReturn {
  tracks: LocalTrack[];
  currentTrack: LocalTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isLoading: boolean;
  addTracks: (files: FileList) => Promise<void>;
  removeTrack: (id: string) => void;
  play: (track?: LocalTrack) => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  audioRef: React.RefObject<HTMLAudioElement>;
}

const AUDIO_FILE_REGEX = /\.(mp3|wav|ogg|flac|m4a|aac)$/i;

function isAudioFile(file: File) {
  return file.type.startsWith("audio/") || AUDIO_FILE_REGEX.test(file.name);
}

function parseFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, "");
  const parts = withoutExtension.split(" - ");

  return {
    title: parts.length > 1 ? parts.slice(1).join(" - ") : withoutExtension,
    artist: parts.length > 1 ? parts[0] : "Unknown Artist",
  };
}

function parseAudioFile(file: File): Promise<LocalTrack> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;

    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("error", handleError);
      audio.src = "";
    };

    const resolveTrack = (duration: number) => {
      if (settled) return;
      settled = true;

      const parsed = parseFileName(file.name);

      cleanup();

      resolve({
        id: crypto.randomUUID(),
        title: parsed.title,
        artist: parsed.artist,
        duration,
        file,
        objectUrl,
      });
    };

    const handleLoadedMetadata = () => {
      resolveTrack(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const handleError = () => {
      resolveTrack(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
    audio.addEventListener("error", handleError, { once: true });
    audio.preload = "metadata";
    audio.src = objectUrl;
  });
}

export function useLocalMusic(): UseLocalMusicReturn {
  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<LocalTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const tracksRef = useRef<LocalTrack[]>([]);
  const currentTrackRef = useRef<LocalTrack | null>(null);
  const lastWholeSecondRef = useRef(-1);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  const play = useCallback(async (track?: LocalTrack) => {
    const audio = audioRef.current;
    const nextTrack = track ?? currentTrackRef.current;

    if (!audio || !nextTrack) return;

    const isNewTrack = currentTrackRef.current?.id !== nextTrack.id;

    if (isNewTrack || audio.src !== nextTrack.objectUrl) {
      audio.src = nextTrack.objectUrl;
      audio.preload = "metadata";
      setCurrentTrack(nextTrack);
      setCurrentTime(0);
      lastWholeSecondRef.current = -1;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Error playing local track:", error);
      setIsPlaying(false);
      toast.error("Unable to play this audio file");
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      pause();
      return;
    }

    await play();
  }, [isPlaying, pause, play]);

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

  const setVolume = useCallback((vol: number) => {
    const safeVolume = Math.max(0, Math.min(1, vol));

    if (audioRef.current) {
      audioRef.current.volume = safeVolume;
    }

    setVolumeState(safeVolume);
  }, []);

  const next = useCallback(async () => {
    const current = currentTrackRef.current;
    const currentTracks = tracksRef.current;

    if (!current || currentTracks.length === 0) return;

    const currentIndex = currentTracks.findIndex((track) => track.id === current.id);
    if (currentIndex === -1) return;

    const nextIndex = (currentIndex + 1) % currentTracks.length;
    await play(currentTracks[nextIndex]);
  }, [play]);

  const previous = useCallback(async () => {
    const current = currentTrackRef.current;
    const currentTracks = tracksRef.current;

    if (!current || currentTracks.length === 0) return;

    const currentIndex = currentTracks.findIndex((track) => track.id === current.id);
    if (currentIndex === -1) return;

    const previousIndex = (currentIndex - 1 + currentTracks.length) % currentTracks.length;
    await play(currentTracks[previousIndex]);
  }, [play]);

  const addTracks = useCallback(async (files: FileList) => {
    setIsLoading(true);

    const audioFiles = Array.from(files).filter(isAudioFile);

    if (audioFiles.length === 0) {
      toast.error("No valid audio files selected");
      setIsLoading(false);
      return;
    }

    try {
      const newTracks = await Promise.all(audioFiles.map(parseAudioFile));

      setTracks((prev) => [...prev, ...newTracks]);

      toast.success(`Added ${newTracks.length} track${newTracks.length > 1 ? "s" : ""}`);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && newTracks.length > 0) {
        const rows = newTracks.map((track) => ({
          title: track.title,
          artist: track.artist,
          album: track.album || null,
          duration_ms: Math.round(track.duration * 1000),
          user_id: user.id,
        }));

        const { error } = await supabase.from("songs").insert(rows);
        if (error) {
          console.error("Error saving tracks:", error);
        }
      }
    } catch (error) {
      console.error("Error adding tracks:", error);
      toast.error("Failed to add some tracks");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeTrack = useCallback((id: string) => {
    setTracks((prev) => {
      const trackToRemove = prev.find((track) => track.id === id);

      if (trackToRemove) {
        URL.revokeObjectURL(trackToRemove.objectUrl);
      }

      return prev.filter((track) => track.id !== id);
    });

    setCurrentTrack((prev) => {
      if (prev?.id !== id) return prev;

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      }

      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      lastWholeSecondRef.current = -1;

      return null;
    });
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;

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
      void next();
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
  }, [next, volume]);

  useEffect(() => {
    return () => {
      for (const track of tracksRef.current) {
        URL.revokeObjectURL(track.objectUrl);
      }
    };
  }, []);

  return {
    tracks,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isLoading,
    addTracks,
    removeTrack,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    next,
    previous,
    audioRef,
  };
}
