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
  play: (track?: LocalTrack) => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  next: () => void;
  previous: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
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

  // Parse audio file metadata
  const parseAudioFile = async (file: File): Promise<LocalTrack> => {
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const audio = new Audio(objectUrl);
      
      audio.addEventListener("loadedmetadata", () => {
        // Extract title from filename (remove extension)
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        const parts = fileName.split(" - ");
        
        resolve({
          id: crypto.randomUUID(),
          title: parts.length > 1 ? parts[1] : fileName,
          artist: parts.length > 1 ? parts[0] : "Unknown Artist",
          duration: audio.duration,
          file,
          objectUrl,
        });
      });

      audio.addEventListener("error", () => {
        resolve({
          id: crypto.randomUUID(),
          title: file.name.replace(/\.[^/.]+$/, ""),
          artist: "Unknown Artist",
          duration: 0,
          file,
          objectUrl,
        });
      });
    });
  };

  const addTracks = useCallback(async (files: FileList) => {
    setIsLoading(true);
    const audioFiles = Array.from(files).filter(
      (file) => file.type.startsWith("audio/") || 
      file.name.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/i)
    );

    if (audioFiles.length === 0) {
      toast.error("No valid audio files selected");
      setIsLoading(false);
      return;
    }

    try {
      const newTracks = await Promise.all(audioFiles.map(parseAudioFile));
      setTracks((prev) => [...prev, ...newTracks]);
      toast.success(`Added ${newTracks.length} track${newTracks.length > 1 ? "s" : ""}`);

      // Save to database
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        for (const track of newTracks) {
          await supabase.from("songs").insert({
            title: track.title,
            artist: track.artist,
            album: track.album || null,
            duration_ms: Math.round(track.duration * 1000),
            user_id: userData.user.id,
          });
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
      const track = prev.find((t) => t.id === id);
      if (track) {
        URL.revokeObjectURL(track.objectUrl);
      }
      return prev.filter((t) => t.id !== id);
    });
    
    if (currentTrack?.id === id) {
      setCurrentTrack(null);
      setIsPlaying(false);
    }
  }, [currentTrack]);

  const play = useCallback((track?: LocalTrack) => {
    if (track) {
      setCurrentTrack(track);
      if (audioRef.current) {
        audioRef.current.src = track.objectUrl;
        audioRef.current.play();
      }
    } else if (audioRef.current && currentTrack) {
      audioRef.current.play();
    }
    setIsPlaying(true);
  }, [currentTrack]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
    setVolumeState(vol);
  }, []);

  const next = useCallback(() => {
    if (!currentTrack || tracks.length === 0) return;
    const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % tracks.length;
    play(tracks[nextIndex]);
  }, [currentTrack, tracks, play]);

  const previous = useCallback(() => {
    if (!currentTrack || tracks.length === 0) return;
    const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    play(tracks[prevIndex]);
  }, [currentTrack, tracks, play]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => next();
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
  }, [next]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      tracks.forEach((track) => URL.revokeObjectURL(track.objectUrl));
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
