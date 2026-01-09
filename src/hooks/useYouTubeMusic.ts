import { useState, useCallback } from "react";

export interface YouTubeTrack {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  embedUrl: string;
}

interface UseYouTubeMusicReturn {
  tracks: YouTubeTrack[];
  currentTrack: YouTubeTrack | null;
  isPlaying: boolean;
  addTrack: (url: string) => Promise<boolean>;
  removeTrack: (id: string) => void;
  playTrack: (track: YouTubeTrack) => void;
  stopTrack: () => void;
  parseYouTubeUrl: (url: string) => string | null;
}

export function useYouTubeMusic(): UseYouTubeMusicReturn {
  const [tracks, setTracks] = useState<YouTubeTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<YouTubeTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const parseYouTubeUrl = useCallback((url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
      /music\.youtube\.com\/watch\?v=([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }, []);

  const addTrack = useCallback(async (url: string): Promise<boolean> => {
    const videoId = parseYouTubeUrl(url);
    if (!videoId) return false;

    // Check if already added
    if (tracks.some((t) => t.videoId === videoId)) {
      return false;
    }

    // Use noembed.com for metadata (no API key required)
    try {
      const response = await fetch(
        `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`
      );
      const data = await response.json();

      const newTrack: YouTubeTrack = {
        id: crypto.randomUUID(),
        videoId,
        title: data.title || "Unknown Title",
        artist: data.author_name || "Unknown Artist",
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`,
      };

      setTracks((prev) => [...prev, newTrack]);
      return true;
    } catch (error) {
      console.error("Error fetching YouTube metadata:", error);
      
      // Add with basic info if metadata fetch fails
      const newTrack: YouTubeTrack = {
        id: crypto.randomUUID(),
        videoId,
        title: "YouTube Video",
        artist: "Unknown",
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`,
      };

      setTracks((prev) => [...prev, newTrack]);
      return true;
    }
  }, [tracks, parseYouTubeUrl]);

  const removeTrack = useCallback((id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
    if (currentTrack?.id === id) {
      setCurrentTrack(null);
      setIsPlaying(false);
    }
  }, [currentTrack]);

  const playTrack = useCallback((track: YouTubeTrack) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  }, []);

  const stopTrack = useCallback(() => {
    setCurrentTrack(null);
    setIsPlaying(false);
  }, []);

  return {
    tracks,
    currentTrack,
    isPlaying,
    addTrack,
    removeTrack,
    playTrack,
    stopTrack,
    parseYouTubeUrl,
  };
}
