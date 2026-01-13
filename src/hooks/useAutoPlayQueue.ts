import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

interface QueuedTrack {
  id: string;
  title: string;
  artist: string;
  tempo: number;
  energy: number;
  audioUrl?: string;
  source: "jamendo" | "local" | "recommendation";
  reason?: string;
}

interface AutoPlayState {
  isEnabled: boolean;
  queue: QueuedTrack[];
  currentIndex: number;
  playedTracks: string[];
  lastQueueUpdate: Date | null;
}

interface UseAutoPlayQueueReturn {
  state: AutoPlayState;
  enableAutoPlay: () => void;
  disableAutoPlay: () => void;
  addToQueue: (tracks: QueuedTrack[]) => void;
  clearQueue: () => void;
  skipToNext: () => QueuedTrack | null;
  getCurrentTrack: () => QueuedTrack | null;
  getNextTrack: () => QueuedTrack | null;
  markTrackPlayed: (trackId: string) => void;
  onTrackEnded: () => QueuedTrack | null;
}

export function useAutoPlayQueue(): UseAutoPlayQueueReturn {
  const [state, setState] = useState<AutoPlayState>({
    isEnabled: false,
    queue: [],
    currentIndex: -1,
    playedTracks: [],
    lastQueueUpdate: null,
  });

  const queueRef = useRef<QueuedTrack[]>([]);

  // Sync ref with state for callbacks
  useEffect(() => {
    queueRef.current = state.queue;
  }, [state.queue]);

  const enableAutoPlay = useCallback(() => {
    setState(prev => ({ ...prev, isEnabled: true }));
    toast.success("Auto-play enabled! Songs will queue automatically based on your biometrics.");
  }, []);

  const disableAutoPlay = useCallback(() => {
    setState(prev => ({ ...prev, isEnabled: false }));
    toast.info("Auto-play disabled");
  }, []);

  const addToQueue = useCallback((tracks: QueuedTrack[]) => {
    setState(prev => {
      // Filter out already played or already queued tracks
      const existingIds = new Set([
        ...prev.queue.map(t => t.id),
        ...prev.playedTracks,
      ]);
      
      const newTracks = tracks.filter(t => !existingIds.has(t.id));
      
      if (newTracks.length === 0) return prev;

      return {
        ...prev,
        queue: [...prev.queue, ...newTracks],
        lastQueueUpdate: new Date(),
      };
    });
  }, []);

  const clearQueue = useCallback(() => {
    setState(prev => ({
      ...prev,
      queue: [],
      currentIndex: -1,
    }));
  }, []);

  const getCurrentTrack = useCallback((): QueuedTrack | null => {
    if (state.currentIndex < 0 || state.currentIndex >= state.queue.length) {
      return null;
    }
    return state.queue[state.currentIndex];
  }, [state.currentIndex, state.queue]);

  const getNextTrack = useCallback((): QueuedTrack | null => {
    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.queue.length) {
      return null;
    }
    return state.queue[nextIndex];
  }, [state.currentIndex, state.queue]);

  const skipToNext = useCallback((): QueuedTrack | null => {
    let nextTrack: QueuedTrack | null = null;

    setState(prev => {
      const nextIndex = prev.currentIndex + 1;
      if (nextIndex >= prev.queue.length) {
        return prev;
      }
      
      nextTrack = prev.queue[nextIndex];
      
      return {
        ...prev,
        currentIndex: nextIndex,
        playedTracks: prev.currentIndex >= 0 
          ? [...prev.playedTracks, prev.queue[prev.currentIndex].id]
          : prev.playedTracks,
      };
    });

    return nextTrack;
  }, []);

  const markTrackPlayed = useCallback((trackId: string) => {
    setState(prev => ({
      ...prev,
      playedTracks: prev.playedTracks.includes(trackId) 
        ? prev.playedTracks 
        : [...prev.playedTracks, trackId],
    }));
  }, []);

  const onTrackEnded = useCallback((): QueuedTrack | null => {
    if (!state.isEnabled) return null;
    
    const nextTrack = skipToNext();
    if (nextTrack) {
      toast.info(`Now playing: "${nextTrack.title}" by ${nextTrack.artist}`);
    }
    return nextTrack;
  }, [state.isEnabled, skipToNext]);

  return {
    state,
    enableAutoPlay,
    disableAutoPlay,
    addToQueue,
    clearQueue,
    skipToNext,
    getCurrentTrack,
    getNextTrack,
    markTrackPlayed,
    onTrackEnded,
  };
}
