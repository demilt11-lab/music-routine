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

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  /youtube\.com\/shorts\/([^&\n?#]+)/,
  /music\.youtube\.com\/watch\?v=([^&\n?#]+)/,
];

function createTrack(videoId: string, title: string, artist: string): YouTubeTrack {
  return {
    id: crypto.randomUUID(),
    videoId,
    title,
    artist,
    thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    embedUrl: `https://www.youtube.com/embed/${videoId}?enablejsapi=1`,
  };
}

export function useYouTubeMusic(): UseYouTubeMusicReturn {
  const [tracks, setTracks] = useState<YouTubeTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<YouTubeTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const parseYouTubeUrl = useCallback((url: string): string | null => {
    const normalizedUrl = url.trim();
    if (!normalizedUrl) return null;

    for (const pattern of YOUTUBE_PATTERNS) {
      const match = normalizedUrl.match(pattern);
      if (match?.[1]) return match[1];
    }

    return null;
  }, []);

  const addTrack = useCallback(
    async (url: string): Promise<boolean> => {
      const videoId = parseYouTubeUrl(url);
      if (!videoId) return false;

      try {
        const response = await fetch(
          `https://noembed.com/embed?url=${encodeURIComponent(
            `https://www.youtube.com/watch?v=${videoId}`
          )}`
        );

        if (!response.ok) {
          throw new Error(`Metadata request failed with status ${response.status}`);
        }

        const data = await response.json();

        let wasAdded = false;

        setTracks((prev) => {
          if (prev.some((track) => track.videoId === videoId)) {
            return prev;
          }

          wasAdded = true;
          return [
            ...prev,
            createTrack(
              videoId,
              data.title || "Unknown Title",
              data.author_name || "Unknown Artist"
            ),
          ];
        });

        return wasAdded;
      } catch (error) {
        console.error("Error fetching YouTube metadata:", error);

        let wasAdded = false;

        setTracks((prev) => {
          if (prev.some((track) => track.videoId === videoId)) {
            return prev;
          }

          wasAdded = true;
          return [...prev, createTrack(videoId, "YouTube Video", "Unknown")];
        });

        return wasAdded;
      }
    },
    [parseYouTubeUrl]
  );

  const removeTrack = useCallback((id: string) => {
    setTracks((prev) => prev.filter((track) => track.id !== id));

    setCurrentTrack((prev) => {
      if (prev?.id !== id) return prev;
      setIsPlaying(false);
      return null;
    });
  }, []);

  const playTrack = useCallback((track: YouTubeTrack) => {
    setCurrentTrack((prev) => {
      if (prev?.id === track.id) return prev;
      return track;
    });
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
